import { createHash, randomBytes } from 'node:crypto';

import type { Sql, TxSql } from '../db/client';
import { writeAudit } from './audit';
import { grantCredit } from './credits';
import { sendNotification } from './notifications';

/**
 * Referrals (GLO-24): give $20 / get $20, all amounts from the ACTIVE
 * `credit_rules` referral row (god-mode editable, no deploys).
 *
 * Lifecycle:
 *  1. attributeSignup — a valid code at signup (or referral.submitCode within
 *     7 days, no purchases) sets users.referred_by and grants the REFEREE's
 *     `referral_give` lot immediately, locked until a first purchase whose
 *     pre-credit total meets the rule's floor.
 *  2. maybePayoutReferrerOnFirstPurchase — when the referee's first purchase
 *     fulfills, the REFERRER's `referral_get` lot is granted, after the
 *     guards: floor met → card-fingerprint self-funding check → monthly caps.
 *  3. Both sides claw back via unwindCreditsForTransaction if that purchase
 *     is refunded or disputed-lost.
 */

type Db = Sql | TxSql;

/** A-Z2-9 minus vowels/0/1/I/O — same alphabet as the migration backfill. */
const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return code;
}

/**
 * sha256(lower(email) + CREDITS_EMAIL_HASH_SALT) — the deleted-account guard.
 * Stored on deletion; checked at attribution so delete-and-resignup can't
 * farm referral/signup credits. Hash (not plaintext) so the PII scrub holds.
 */
export function hashEmailForDeletionGuard(email: string): string {
  const salt = process.env.CREDITS_EMAIL_HASH_SALT ?? '';
  return createHash('sha256').update(email.trim().toLowerCase() + salt).digest('hex');
}

/** Lazily mint a user's shareable code (new JIT users get one at insert;
 *  this covers pre-backfill stragglers and races). */
export async function ensureReferralCode(sql: Sql, userId: string): Promise<string> {
  const rows = await sql<{ referral_code: string | null }[]>`
    SELECT referral_code FROM public.users WHERE id = ${userId} LIMIT 1
  `;
  if (rows[0]?.referral_code) return rows[0].referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const updated = await sql<{ referral_code: string }[]>`
      UPDATE public.users SET referral_code = ${code}, updated_at = now()
      WHERE id = ${userId}
        AND referral_code IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = ${code})
      RETURNING referral_code
    `;
    if (updated[0]) return updated[0].referral_code;
    // Either a collision (roll again) or a concurrent writer won (re-read).
    const reread = await sql<{ referral_code: string | null }[]>`
      SELECT referral_code FROM public.users WHERE id = ${userId} LIMIT 1
    `;
    if (reread[0]?.referral_code) return reread[0].referral_code;
  }
  throw new Error('Could not allocate a referral code');
}

interface ReferralRule {
  id: string;
  give_cents: number;
  get_cents: number;
  min_first_purchase_cents: number;
  expires_after_days: number;
  monthly_user_cap_cents: number | null;
  monthly_referral_payout_cap: number | null;
}

async function getActiveReferralRule(sql: Db): Promise<ReferralRule | null> {
  const rows = await sql<ReferralRule[]>`
    SELECT id, give_cents, get_cents, COALESCE(min_first_purchase_cents, 0) AS min_first_purchase_cents,
           expires_after_days, monthly_user_cap_cents, monthly_referral_payout_cap
    FROM public.credit_rules
    WHERE rule_type = 'referral' AND active = true
      AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Sum of referral/signup-kind earns this calendar month (the per-user cap pool). */
async function cappedEarnsThisMonthCents(sql: Db, userId: string): Promise<number> {
  const rows = await sql<{ total: number }[]>`
    SELECT COALESCE(SUM(amount_cents), 0)::int AS total
    FROM public.credit_lots
    WHERE user_id = ${userId}
      AND kind IN ('referral_give', 'referral_get', 'signup_bonus')
      AND created_at >= date_trunc('month', now())
  `;
  return rows[0]?.total ?? 0;
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface AttributeSignupResult {
  attributed: boolean;
  reason:
    | 'attributed'
    | 'invalid_code'
    | 'code_not_found'
    | 'self_referral'
    | 'already_attributed'
    | 'already_purchased'
    | 'signup_too_old'
    | 'previously_deleted_account'
    | 'no_active_rule'
    | 'monthly_cap'
    | 'race_lost'
    | 'user_not_found';
}

/**
 * Link a new user to their referrer and grant the referee's locked lot.
 * Called fire-and-forget from the JIT user insert (context/auth.ts) and from
 * referral.submitCode. Never throws — refusals are audited and reported back.
 */
export async function attributeSignup(
  sql: Sql,
  args: { userId: string; code: string; email: string | null },
): Promise<AttributeSignupResult> {
  const refuse = (reason: AttributeSignupResult['reason'], meta: Record<string, unknown> = {}) => {
    void writeAudit(sql, {
      action: 'referral.attribution_refused',
      meta: { refereeId: args.userId, codeAttempted: args.code, reason, ...meta },
    });
    return { attributed: false as const, reason };
  };

  try {
    const code = args.code.trim().toUpperCase();
    if (!/^[A-Z2-9]{4,12}$/.test(code)) return refuse('invalid_code');

    const referrerRows = await sql<{ id: string }[]>`
      SELECT id FROM public.users
      WHERE referral_code = ${code} AND deleted_at IS NULL
      LIMIT 1
    `;
    const referrer = referrerRows[0];
    if (!referrer) return refuse('code_not_found');
    if (referrer.id === args.userId) return refuse('self_referral');

    const userRows = await sql<{
      referred_by: string | null;
      first_name: string | null;
      created_at: string;
    }[]>`
      SELECT referred_by, first_name, created_at FROM public.users
      WHERE id = ${args.userId} LIMIT 1
    `;
    const user = userRows[0];
    if (!user) return refuse('user_not_found');
    if (user.referred_by) return refuse('already_attributed');
    if (Date.now() - new Date(user.created_at).getTime() > 7 * 86_400_000) {
      return refuse('signup_too_old');
    }

    const purchased = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM public.transactions
      WHERE user_id = ${args.userId} AND paid_at IS NOT NULL LIMIT 1
    `;
    if (purchased[0]) return refuse('already_purchased');

    // Deleted-account guard: a hash match means this email already had (and
    // deleted) an account — not genuinely new, no referral credits either side.
    if (args.email) {
      const hashed = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM public.deleted_account_email_hashes
        WHERE email_hash = ${hashEmailForDeletionGuard(args.email)} LIMIT 1
      `;
      if (hashed[0]) return refuse('previously_deleted_account', { referrerId: referrer.id });
    }

    const rule = await getActiveReferralRule(sql);
    if (!rule) return refuse('no_active_rule');

    if (rule.monthly_user_cap_cents !== null) {
      const earned = await cappedEarnsThisMonthCents(sql, args.userId);
      if (earned + rule.give_cents > rule.monthly_user_cap_cents) {
        return refuse('monthly_cap', { referrerId: referrer.id, earnedThisMonthCents: earned });
      }
    }

    const linked = await sql<{ id: string }[]>`
      UPDATE public.users SET referred_by = ${referrer.id}, updated_at = now()
      WHERE id = ${args.userId} AND referred_by IS NULL
      RETURNING id
    `;
    if (!linked[0]) return refuse('race_lost');

    const grant = await grantCredit(sql, {
      userId: args.userId,
      kind: 'referral_give',
      amountCents: rule.give_cents,
      expiresAfterDays: rule.expires_after_days,
      ruleId: rule.id,
      referralId: args.userId, // referral pair key = the referee's id, both sides
      note: `Referral welcome credit — unlocks on your first booking of ${money(rule.min_first_purchase_cents)}+`,
      notify: {
        title: `${money(rule.give_cents)} in Gloē credit`,
        body: `Your welcome credit applies automatically on your first booking of ${money(rule.min_first_purchase_cents)}+.`,
      },
    });

    void writeAudit(sql, {
      action: 'referral.attributed',
      meta: {
        referrerId: referrer.id,
        refereeId: args.userId,
        code,
        giveCents: rule.give_cents,
        getCents: rule.get_cents,
        ruleId: rule.id,
        giveLotId: grant.lotId,
        duplicateGrant: grant.duplicate,
      },
    });
    void sendNotification(sql, 'referral_attributed', referrer.id, {
      vars: { refereeName: user.first_name ?? 'A friend', amount: money(rule.get_cents) },
      data: { type: 'referral_attributed', refereeId: args.userId },
    });

    return { attributed: true, reason: 'attributed' };
  } catch (e) {
    console.error('[referral] attributeSignup failed:', (e as Error).message);
    return { attributed: false, reason: 'race_lost' };
  }
}

/**
 * Pay the referrer when the referee's FIRST purchase fulfills. Called from
 * the fulfillment core (all paths: webhook PI, webhook session, zero-dollar
 * inline). Fire-and-forget but every outcome is audited. Guards, in order:
 * first purchase → floor (pre-credit total) → card-fingerprint self-funding
 * → monthly caps. Idempotent via the (kind, referral_id) lot wall.
 */
export async function maybePayoutReferrerOnFirstPurchase(
  sql: Sql,
  transactionId: string,
): Promise<void> {
  try {
    const txnRows = await sql<{
      user_id: string;
      consumer_paid_cents: number;
      card_fingerprint: string | null;
      paid_at: string | null;
      referred_by: string | null;
      first_name: string | null;
    }[]>`
      SELECT t.user_id, t.consumer_paid_cents, t.card_fingerprint, t.paid_at,
             u.referred_by, u.first_name
      FROM public.transactions t
      JOIN public.users u ON u.id = t.user_id
      WHERE t.id = ${transactionId} LIMIT 1
    `;
    const txn = txnRows[0];
    if (!txn || !txn.paid_at || !txn.referred_by) return;
    const referrerId = txn.referred_by;

    const refuse = (reason: string, meta: Record<string, unknown> = {}) => {
      void writeAudit(sql, {
        action: 'referral.payout_refused',
        transactionId,
        meta: { referrerId, refereeId: txn.user_id, reason, ...meta },
      });
    };

    // Only the FIRST purchase qualifies — an earlier paid txn means this isn't it.
    const earlier = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM public.transactions
      WHERE user_id = ${txn.user_id} AND paid_at IS NOT NULL
        AND id <> ${transactionId} AND paid_at < ${txn.paid_at}
      LIMIT 1
    `;
    if (earlier[0]) return; // not their first — silent, the common case forever after

    const rule = await getActiveReferralRule(sql);
    if (!rule) return refuse('no_active_rule');

    // Floor is on the PRE-credit order value — credits applied don't dodge it.
    if (txn.consumer_paid_cents < rule.min_first_purchase_cents) {
      return refuse('first_purchase_below_floor', {
        consumerPaidCents: txn.consumer_paid_cents,
        floorCents: rule.min_first_purchase_cents,
      });
    }

    // Self-funding guard: same physical card on both sides of the "referral"
    // → VOID the referrer payout (the referee keeps theirs).
    if (txn.card_fingerprint) {
      const sameCard = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM public.transactions
        WHERE user_id = ${referrerId} AND card_fingerprint = ${txn.card_fingerprint}
          AND id <> ${transactionId}
        LIMIT 1
      `;
      if (sameCard[0]) {
        void writeAudit(sql, {
          action: 'referral.payout_voided',
          transactionId,
          meta: {
            referrerId,
            refereeId: txn.user_id,
            reason: 'card_fingerprint_match',
            cardFingerprint: txn.card_fingerprint,
          },
        });
        return;
      }
    }

    if (rule.monthly_referral_payout_cap !== null) {
      const payoutRows = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM public.credit_lots
        WHERE user_id = ${referrerId} AND kind = 'referral_get'
          AND created_at >= date_trunc('month', now())
      `;
      if ((payoutRows[0]?.count ?? 0) >= rule.monthly_referral_payout_cap) {
        return refuse('monthly_payout_cap', { capPayouts: rule.monthly_referral_payout_cap });
      }
    }
    if (rule.monthly_user_cap_cents !== null) {
      const earned = await cappedEarnsThisMonthCents(sql, referrerId);
      if (earned + rule.get_cents > rule.monthly_user_cap_cents) {
        return refuse('monthly_cap', { earnedThisMonthCents: earned, capCents: rule.monthly_user_cap_cents });
      }
    }

    const grant = await grantCredit(sql, {
      userId: referrerId,
      kind: 'referral_get',
      amountCents: rule.get_cents,
      expiresAfterDays: rule.expires_after_days,
      ruleId: rule.id,
      transactionId, // the qualifying purchase — the unwind hook on refund/dispute
      referralId: txn.user_id,
      note: 'Referral reward — your friend made their first booking',
    });
    if (grant.duplicate) return; // webhook retry — already paid

    void writeAudit(sql, {
      action: 'referral.completed',
      transactionId,
      meta: {
        referrerId,
        refereeId: txn.user_id,
        getCents: rule.get_cents,
        ruleId: rule.id,
        getLotId: grant.lotId,
      },
    });
    void sendNotification(sql, 'referral_complete', referrerId, {
      vars: { refereeName: txn.first_name ?? 'Your friend', amount: money(rule.get_cents) },
      data: { type: 'referral_complete', refereeId: txn.user_id },
    });
  } catch (e) {
    // Fire-and-forget: a referral hiccup must never disturb fulfillment.
    console.error('[referral] payout check failed:', (e as Error).message);
  }
}
