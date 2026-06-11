import type { Sql, TxSql } from '../db/client';
import { writeAudit } from './audit';
import { sendNotification } from './notifications';

/**
 * Wallet credits (GLO-24) — lot-based, append-only ledger.
 *
 * Credits are PLATFORM-funded: they reduce the customer's cash charge only.
 * Vendor payout math never changes — `vendor_payout_cents` stays computed on
 * the full order value, so the platform's effective margin on a credited txn
 * is `platform_fee_cents − credits_applied_cents`.
 *
 * Shape:
 *  - Every GRANT is a `credit_lots` row; `remaining_cents` is the only mutable
 *    column (drawdown). Clawback may push it negative, netting future earns.
 *  - Every debit is an append-only `credit_entries` row pointing at its lot.
 *  - Balance = SUM(remaining_cents) across lots (negatives net the total);
 *    UI displays max(0, balance).
 *  - `grantCredit()` is the ONE door — nothing else inserts lots.
 *
 * Audit convention: functions that own their own flow (grant/return/unwind/
 * forfeit/expire) write audit rows internally with the handle they're given.
 * Functions designed to run inside a caller's `sql.begin` (compute/redeem)
 * return a summary and the CALLER audits post-commit — an audit INSERT that
 * failed mid-transaction would poison the whole txn.
 */

type Db = Sql | TxSql;

/** Stripe refuses charges under 50¢ — the split-tender floor rule. */
export const STRIPE_MIN_CHARGE_CENTS = 50;

export type CreditLotKind =
  | 'referral_give'   // referee's lot, granted at attribution (locked until first qualifying purchase)
  | 'referral_get'    // referrer's lot, granted when the referee's first purchase fulfills
  | 'purchase_reward' // purchase-tier earn (built, inactive at launch)
  | 'signup_bonus'    // built, inactive at launch
  | 'promo'           // push-credit campaign
  | 'admin_grant'     // god-mode manual grant
  | 'refund_return';  // credit share of a refund coming back

export type CreditEntryKind = 'redemption' | 'expiry' | 'clawback' | 'forfeiture';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Grant (the one door) ─────────────────────────────────────────────────────

export interface GrantCreditInput {
  userId: string;
  kind: CreditLotKind;
  amountCents: number;
  /** Explicit expiry (ISO). Wins over expiresAfterDays. Null/omitted with no days = never expires. */
  expiresAt?: string | null;
  expiresAfterDays?: number | null;
  ruleId?: string | null;
  campaignId?: string | null;
  /** The EARNING transaction (purchase_reward / referral_get / refund_return). */
  transactionId?: string | null;
  /** Referral pair key — the REFEREE's user id on both sides of a referral. */
  referralId?: string | null;
  note?: string | null;
  actorUserId?: string | null;
  /**
   * Push via the `credit_granted` registry type (its templates render
   * caller-supplied {{title}}/{{body}}). Only honored when `sql` is the pool
   * handle — inside a caller's txn, notify post-commit yourself.
   */
  notify?: { title: string; body: string } | null;
  /** Also send the branded CreditGrantedEmail (campaign / admin grants). */
  sendEmail?: boolean;
}

export interface GrantCreditResult {
  granted: boolean;
  /** True when an idempotency wall (kind+txn / kind+referral / campaign+user) absorbed a retry. */
  duplicate: boolean;
  lotId: string | null;
  expiresAt: string | null;
}

/**
 * Mint one credit lot. Idempotent against the partial unique walls on
 * credit_lots — a webhook retry or double-click returns `duplicate: true`
 * instead of double-granting. Audits every successful grant.
 */
export async function grantCredit(sql: Db, input: GrantCreditInput): Promise<GrantCreditResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('grantCredit: amountCents must be a positive integer');
  }

  const rows = await sql<{ id: string; expires_at: string | null }[]>`
    INSERT INTO public.credit_lots (
      user_id, kind, amount_cents, remaining_cents, expires_at,
      rule_id, campaign_id, transaction_id, referral_id, note
    ) VALUES (
      ${input.userId}, ${input.kind}, ${input.amountCents}, ${input.amountCents},
      ${input.expiresAt !== undefined
        ? input.expiresAt
        : input.expiresAfterDays
          ? sql`now() + (${input.expiresAfterDays} * interval '1 day')`
          : null},
      ${input.ruleId ?? null}, ${input.campaignId ?? null},
      ${input.transactionId ?? null}, ${input.referralId ?? null}, ${input.note ?? null}
    )
    ON CONFLICT DO NOTHING
    RETURNING id, expires_at
  `;
  const lot = rows[0];
  if (!lot) return { granted: false, duplicate: true, lotId: null, expiresAt: null };

  void writeAudit(sql as Sql, {
    action: 'credit.granted',
    actorUserId: input.actorUserId ?? null,
    transactionId: input.transactionId ?? null,
    meta: {
      lotId: lot.id,
      userId: input.userId,
      kind: input.kind,
      amountCents: input.amountCents,
      expiresAt: lot.expires_at,
      ruleId: input.ruleId ?? null,
      campaignId: input.campaignId ?? null,
      referralId: input.referralId ?? null,
      note: input.note ?? null,
    },
  });

  if (input.notify) {
    void sendNotification(sql as Sql, 'credit_granted', input.userId, {
      vars: input.notify,
      data: { type: 'credit_granted', lotId: lot.id },
    });
  }
  if (input.sendEmail) {
    void import('./transactionalEmails')
      .then((m) => m.sendCreditGrantedEmail(sql as Sql, {
        userId: input.userId,
        lotId: lot.id,
        amountCents: input.amountCents,
        expiresAt: lot.expires_at,
        message: input.note ?? null,
      }))
      .catch((e) => console.error('[credit email] failed:', (e as Error).message));
  }

  return { granted: true, duplicate: false, lotId: lot.id, expiresAt: lot.expires_at };
}

// ── Spendability (shared by compute + redeem so they never disagree) ─────────

interface SpendLotRow {
  id: string;
  kind: CreditLotKind;
  remaining_cents: number;
  expires_at: string | null;
  min_first_purchase_cents: number | null;
}

/** Locks the user's lots for the duration of the caller's transaction. */
async function lockLots(sql: Db, userId: string): Promise<SpendLotRow[]> {
  return await sql<SpendLotRow[]>`
    SELECT l.id, l.kind, l.remaining_cents, l.expires_at, r.min_first_purchase_cents
    FROM public.credit_lots l
    LEFT JOIN public.credit_rules r ON r.id = l.rule_id
    WHERE l.user_id = ${userId} AND l.remaining_cents <> 0
    ORDER BY l.expires_at ASC NULLS LAST, l.created_at ASC
    FOR UPDATE OF l
  `;
}

async function hasPriorPaidPurchase(
  sql: Db,
  userId: string,
  excludeTransactionId: string | null,
): Promise<boolean> {
  const rows = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM public.transactions
    WHERE user_id = ${userId} AND paid_at IS NOT NULL
      AND id IS DISTINCT FROM ${excludeTransactionId}
    LIMIT 1
  `;
  return !!rows[0];
}

/**
 * Splits locked lots into FIFO-spendable positives and the negative net.
 * A referral_give lot is locked until a FIRST purchase whose pre-credit total
 * meets the rule's floor — outside that, it's invisible to spend.
 */
function partitionSpendable(
  lots: SpendLotRow[],
  args: { orderTotalCents: number; isFirstPurchase: boolean },
): { eligible: SpendLotRow[]; spendCapCents: number } {
  const now = Date.now();
  let negativeCents = 0;
  const eligible: SpendLotRow[] = [];
  for (const lot of lots) {
    if (lot.remaining_cents < 0) {
      negativeCents += lot.remaining_cents; // debt never expires; always nets
      continue;
    }
    if (lot.expires_at && new Date(lot.expires_at).getTime() <= now) continue;
    if (lot.kind === 'referral_give') {
      const floor = lot.min_first_purchase_cents ?? 0;
      if (!args.isFirstPurchase || args.orderTotalCents < floor) continue;
    }
    eligible.push(lot);
  }
  const eligibleSum = eligible.reduce((s, l) => s + l.remaining_cents, 0);
  return { eligible, spendCapCents: Math.max(0, eligibleSum + negativeCents) };
}

// ── Checkout-side: how much to apply ─────────────────────────────────────────

/**
 * How many cents of credit to auto-apply to an order. MUST run inside the
 * caller's `sql.begin` — it locks the user's lots (FOR UPDATE) so two
 * concurrent checkouts can't both spend the same balance, and the caller's
 * `credits_applied_cents` INSERT in the same txn becomes the reservation a
 * later checkout sees.
 *
 * Rules applied here:
 *  - frozen ledger (open dispute) → 0
 *  - locked referral_give lots only count on a first purchase ≥ their floor
 *  - recent pending_payment reservations are subtracted (1h window — older
 *    pendings are abandoned PaymentSheets and must not strand credits forever)
 *  - Stripe's 50¢ floor: never leave 0 < cash < 50; shave credits so cash
 *    is exactly 50¢ (zero cash is fine — that's the zero-dollar path)
 */
export async function computeApplicableCredits(
  sql: Db,
  args: { userId: string; orderTotalCents: number },
): Promise<number> {
  if (args.orderTotalCents <= 0) return 0;

  const userRows = await sql<{ credit_frozen_at: string | null }[]>`
    SELECT credit_frozen_at FROM public.users WHERE id = ${args.userId} LIMIT 1
  `;
  if (!userRows[0] || userRows[0].credit_frozen_at) return 0;

  const lots = await lockLots(sql, args.userId);
  if (lots.length === 0) return 0;

  const isFirstPurchase = !(await hasPriorPaidPurchase(sql, args.userId, null));
  const { spendCapCents } = partitionSpendable(lots, {
    orderTotalCents: args.orderTotalCents,
    isFirstPurchase,
  });
  if (spendCapCents <= 0) return 0;

  const reservedRows = await sql<{ reserved: number }[]>`
    SELECT COALESCE(SUM(credits_applied_cents), 0)::int AS reserved
    FROM public.transactions
    WHERE user_id = ${args.userId} AND status = 'pending_payment'
      AND credits_applied_cents > 0
      AND created_at > now() - interval '1 hour'
  `;
  const available = Math.max(0, spendCapCents - (reservedRows[0]?.reserved ?? 0));

  let applied = Math.min(available, args.orderTotalCents);
  const cash = args.orderTotalCents - applied;
  if (cash > 0 && cash < STRIPE_MIN_CHARGE_CENTS) {
    // Can't charge Stripe under 50¢ — give up just enough credit instead.
    applied = Math.max(0, args.orderTotalCents - STRIPE_MIN_CHARGE_CENTS);
  }
  return applied;
}

// ── Fulfillment-side: consume the reservation ────────────────────────────────

export interface RedeemSummary {
  redeemedCents: number;
  /** Reserved-but-unavailable cents (lost race) the platform ate. Always 0 in practice. */
  shortfallCents: number;
  lots: Array<{ lotId: string; cents: number }>;
}

/**
 * Consume lots FIFO (expires_at NULLS LAST, created_at) for a paid purchase.
 * MUST run in the SAME `sql.begin` as fulfillment so vouchers and the credit
 * drawdown commit (or roll back) together. Idempotent on the transaction —
 * if a redemption entry already exists for this txn, it's a no-op, so a
 * duplicate webhook can't double-spend.
 *
 * If lots cover less than the reservation (a pending-window race), we consume
 * what exists and report the shortfall — the charge already went out reduced,
 * so refusing here would hand out free credit. Caller audits the summary.
 */
export async function redeemCreditsForTransaction(
  sql: Db,
  args: { userId: string; transactionId: string; amountCents: number; orderTotalCents: number },
): Promise<RedeemSummary> {
  const empty: RedeemSummary = { redeemedCents: 0, shortfallCents: 0, lots: [] };
  if (args.amountCents <= 0) return empty;

  const existing = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM public.credit_entries
    WHERE transaction_id = ${args.transactionId} AND kind = 'redemption'
    LIMIT 1
  `;
  if (existing[0]) return empty; // already consumed for this txn

  const lots = await lockLots(sql, args.userId);
  const isFirstPurchase = !(await hasPriorPaidPurchase(sql, args.userId, args.transactionId));
  const { eligible, spendCapCents } = partitionSpendable(lots, {
    orderTotalCents: args.orderTotalCents,
    isFirstPurchase,
  });

  let toConsume = Math.min(args.amountCents, spendCapCents);
  const consumed: Array<{ lotId: string; cents: number }> = [];
  for (const lot of eligible) {
    if (toConsume <= 0) break;
    const take = Math.min(lot.remaining_cents, toConsume);
    await sql`
      UPDATE public.credit_lots
      SET remaining_cents = remaining_cents - ${take}
      WHERE id = ${lot.id}
    `;
    await sql`
      INSERT INTO public.credit_entries (user_id, kind, amount_cents, transaction_id, lot_id, meta)
      VALUES (${args.userId}, 'redemption', ${-take}, ${args.transactionId}, ${lot.id},
              ${sql.json({ orderTotalCents: args.orderTotalCents })})
    `;
    consumed.push({ lotId: lot.id, cents: take });
    toConsume -= take;
  }

  const redeemedCents = consumed.reduce((s, c) => s + c.cents, 0);
  return { redeemedCents, shortfallCents: args.amountCents - redeemedCents, lots: consumed };
}

// ── Refund-side: return the credit share ─────────────────────────────────────

/**
 * Returns the credit share of a refund as a `refund_return` lot.
 *
 * Expiry = the most generous of the consumed lots' remaining windows, never
 * less than 30 days out (and perpetual if any consumed lot never expired).
 *
 * Partial-refund note: the (kind, transaction_id) idempotency wall means one
 * refund_return lot per txn — a SECOND partial refund that dips into credits
 * grows that same lot instead of minting another. Updates the transaction's
 * `credits_refunded_cents` itself; the caller still owns `refunded_cents` (cash).
 */
export async function returnCreditsForTransaction(
  sql: Sql,
  args: { transactionId: string; amountCents: number; actorUserId?: string | null; reason?: string | null },
): Promise<{ returnedCents: number; lotId: string | null }> {
  if (args.amountCents <= 0) return { returnedCents: 0, lotId: null };

  const result = await sql.begin(async (tx) => {
    const txnRows = await tx<{
      user_id: string;
      credits_applied_cents: number;
      credits_refunded_cents: number;
    }[]>`
      SELECT user_id, credits_applied_cents, credits_refunded_cents
      FROM public.transactions WHERE id = ${args.transactionId} LIMIT 1 FOR UPDATE
    `;
    const txn = txnRows[0];
    if (!txn) return null;
    const returnable = txn.credits_applied_cents - txn.credits_refunded_cents;
    const amount = Math.min(args.amountCents, returnable);
    if (amount <= 0) return null;

    // Most generous expiry across the lots this purchase consumed.
    const expiryRows = await tx<{ max_expiry: string | null; has_perpetual: boolean }[]>`
      SELECT MAX(l.expires_at) AS max_expiry,
             BOOL_OR(l.expires_at IS NULL) AS has_perpetual
      FROM public.credit_entries e
      JOIN public.credit_lots l ON l.id = e.lot_id
      WHERE e.transaction_id = ${args.transactionId} AND e.kind = 'redemption'
    `;
    const floor = new Date(Date.now() + 30 * 86_400_000);
    const maxExpiry = expiryRows[0]?.max_expiry ? new Date(expiryRows[0].max_expiry) : null;
    const expiresAt = expiryRows[0]?.has_perpetual
      ? null
      : (maxExpiry && maxExpiry > floor ? maxExpiry : floor).toISOString();

    const grant = await grantCredit(tx, {
      userId: txn.user_id,
      kind: 'refund_return',
      amountCents: amount,
      expiresAt,
      transactionId: args.transactionId,
      note: args.reason ?? 'Credit returned from a refund',
    });
    let lotId = grant.lotId;
    if (grant.duplicate) {
      // Second partial refund into credits → grow the existing return lot.
      const grown = await tx<{ id: string }[]>`
        UPDATE public.credit_lots
        SET amount_cents    = amount_cents + ${amount},
            remaining_cents = remaining_cents + ${amount},
            expires_at      = CASE
              WHEN expires_at IS NULL OR ${expiresAt}::timestamptz IS NULL THEN NULL
              ELSE GREATEST(expires_at, ${expiresAt}::timestamptz)
            END
        WHERE kind = 'refund_return' AND transaction_id = ${args.transactionId}
        RETURNING id
      `;
      lotId = grown[0]?.id ?? null;
    }

    await tx`
      UPDATE public.transactions
      SET credits_refunded_cents = credits_refunded_cents + ${amount},
          updated_at             = now()
      WHERE id = ${args.transactionId}
    `;
    return { userId: txn.user_id, amount, lotId, grew: grant.duplicate };
  });

  if (!result) return { returnedCents: 0, lotId: null };

  void writeAudit(sql, {
    action: 'credit.returned',
    actorUserId: args.actorUserId ?? null,
    transactionId: args.transactionId,
    meta: { lotId: result.lotId, amountCents: result.amount, grewExistingLot: result.grew, reason: args.reason ?? null },
  });
  void sendNotification(sql, 'credit_granted', result.userId, {
    vars: {
      title: 'Your credit is back',
      body: `${money(result.amount)} in Gloē credit was returned from your refund.`,
    },
    data: { type: 'credit_returned', transactionId: args.transactionId },
  });

  return { returnedCents: result.amount, lotId: result.lotId };
}

// ── Clawback: reverse what a transaction EARNED ──────────────────────────────

export type UnwindMode = 'refund' | 'dispute_lost';

/**
 * Reverses credit lots EARNED from a transaction (purchase_reward,
 * referral_get — and the referee's referral_give when this was the qualifying
 * first purchase). The clawback entry reverses the FULL granted amount;
 * `remaining_cents` may go negative, netting against future earns.
 *
 * Mode:
 *  - 'dispute_lost' → claw everything unconditionally.
 *  - 'refund'       → claw a lot only when the refund broke its qualifying
 *    condition: post-refund pre-credit value < the rule's minimum (tier min /
 *    referral first-purchase floor), or the txn is fully refunded. A small
 *    courtesy partial refund on a big order keeps earned credits.
 *
 * Idempotent per lot (one clawback entry each); used by refunds AND disputes.
 */
export async function unwindCreditsForTransaction(
  sql: Sql,
  transactionId: string,
  mode: UnwindMode,
  actorUserId?: string | null,
): Promise<{ clawedCents: number; lotCount: number }> {
  const clawed = await sql.begin(async (tx) => {
    const txnRows = await tx<{
      user_id: string;
      consumer_paid_cents: number;
      refunded_cents: number;
      credits_refunded_cents: number;
      referred_by: string | null;
    }[]>`
      SELECT t.user_id, t.consumer_paid_cents, t.refunded_cents, t.credits_refunded_cents,
             u.referred_by
      FROM public.transactions t
      JOIN public.users u ON u.id = t.user_id
      WHERE t.id = ${transactionId} LIMIT 1 FOR UPDATE OF t
    `;
    const txn = txnRows[0];
    if (!txn) return [];
    const remainingValueCents =
      txn.consumer_paid_cents - txn.refunded_cents - txn.credits_refunded_cents;

    interface EarnedLot {
      id: string; user_id: string; kind: CreditLotKind; amount_cents: number;
      referral_id: string | null; min_purchase_cents: number | null;
      min_first_purchase_cents: number | null;
    }
    const earned = await tx<EarnedLot[]>`
      SELECT l.id, l.user_id, l.kind, l.amount_cents, l.referral_id,
             r.min_purchase_cents, r.min_first_purchase_cents
      FROM public.credit_lots l
      LEFT JOIN public.credit_rules r ON r.id = l.rule_id
      WHERE l.transaction_id = ${transactionId}
        AND l.kind IN ('purchase_reward', 'referral_get')
      FOR UPDATE OF l
    `;

    // The referee's give-side lot pairs with the qualifying purchase even
    // though it was granted at attribution (transaction_id IS NULL on it).
    // No referral_get lot (e.g. fingerprint-voided payout) → it was still the
    // qualifying purchase if this is the user's EARLIEST paid transaction.
    let refereeId = earned.find((l) => l.kind === 'referral_get')?.referral_id ?? null;
    if (!refereeId && txn.referred_by) {
      const earlier = await tx<{ one: number }[]>`
        SELECT 1 AS one FROM public.transactions
        WHERE user_id = ${txn.user_id} AND paid_at IS NOT NULL AND id <> ${transactionId}
          AND paid_at < (SELECT paid_at FROM public.transactions WHERE id = ${transactionId})
        LIMIT 1
      `;
      if (!earlier[0]) refereeId = txn.user_id;
    }
    if (refereeId) {
      const giveLots = await tx<EarnedLot[]>`
        SELECT l.id, l.user_id, l.kind, l.amount_cents, l.referral_id,
               r.min_purchase_cents, r.min_first_purchase_cents
        FROM public.credit_lots l
        LEFT JOIN public.credit_rules r ON r.id = l.rule_id
        WHERE l.kind = 'referral_give' AND l.referral_id = ${refereeId}
        FOR UPDATE OF l
      `;
      earned.push(...giveLots);
    }

    const results: Array<{ lotId: string; kind: string; cents: number; userId: string }> = [];
    for (const lot of earned) {
      if (mode === 'refund') {
        const threshold = lot.kind === 'purchase_reward'
          ? lot.min_purchase_cents ?? 0
          : lot.min_first_purchase_cents ?? 0;
        const stillQualifies = remainingValueCents > 0 && remainingValueCents >= threshold;
        if (stillQualifies) continue;
      }
      const entry = await tx<{ id: string }[]>`
        INSERT INTO public.credit_entries (user_id, kind, amount_cents, transaction_id, lot_id, meta)
        SELECT ${lot.user_id}, 'clawback', ${-lot.amount_cents}, ${transactionId}, ${lot.id},
               ${tx.json({ mode, lotKind: lot.kind })}
        WHERE NOT EXISTS (
          SELECT 1 FROM public.credit_entries WHERE lot_id = ${lot.id} AND kind = 'clawback'
        )
        RETURNING id
      `;
      if (!entry[0]) continue; // already clawed (retry / refund-then-dispute)
      await tx`
        UPDATE public.credit_lots
        SET remaining_cents = remaining_cents - ${lot.amount_cents}
        WHERE id = ${lot.id}
      `;
      results.push({ lotId: lot.id, kind: lot.kind, cents: lot.amount_cents, userId: lot.user_id });
    }
    return results;
  });

  for (const c of clawed) {
    void writeAudit(sql, {
      action: 'credit.clawed_back',
      actorUserId: actorUserId ?? null,
      transactionId,
      meta: { mode, lotId: c.lotId, lotKind: c.kind, amountCents: c.cents, userId: c.userId },
    });
  }
  return { clawedCents: clawed.reduce((s, c) => s + c.cents, 0), lotCount: clawed.length };
}

// ── Dispute freeze ───────────────────────────────────────────────────────────

/** Freeze the user's ledger (open dispute). Redemption refuses while frozen.
 *  Returns whether this call changed state. Caller audits. */
export async function freezeCreditLedger(sql: Db, userId: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE public.users SET credit_frozen_at = now(), updated_at = now()
    WHERE id = ${userId} AND credit_frozen_at IS NULL
    RETURNING id
  `;
  return !!rows[0];
}

/** Thaw after a dispute resolves in our favor. Caller audits. */
export async function unfreezeCreditLedger(sql: Db, userId: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE public.users SET credit_frozen_at = NULL, updated_at = now()
    WHERE id = ${userId} AND credit_frozen_at IS NOT NULL
    RETURNING id
  `;
  return !!rows[0];
}

// ── Account deletion forfeiture ──────────────────────────────────────────────

/**
 * Zero every positive lot for a user (account deletion). Negative lots stay —
 * a deleted account doesn't escape a clawback debt on the books. Returns the
 * total forfeited so the deletion response can say "you forfeited $X".
 */
export async function forfeitAllForUser(
  sql: Sql,
  userId: string,
  args?: { actorUserId?: string | null; reason?: string | null },
): Promise<{ forfeitedCents: number; lotCount: number }> {
  const forfeited = await sql.begin(async (tx) => {
    const lots = await tx<{ id: string; remaining_cents: number }[]>`
      SELECT id, remaining_cents FROM public.credit_lots
      WHERE user_id = ${userId} AND remaining_cents > 0
      FOR UPDATE
    `;
    const results: Array<{ lotId: string; cents: number }> = [];
    for (const lot of lots) {
      await tx`
        UPDATE public.credit_lots SET remaining_cents = 0 WHERE id = ${lot.id}
      `;
      await tx`
        INSERT INTO public.credit_entries (user_id, kind, amount_cents, lot_id, meta)
        VALUES (${userId}, 'forfeiture', ${-lot.remaining_cents}, ${lot.id},
                ${tx.json({ reason: args?.reason ?? 'account_deleted' })})
      `;
      results.push({ lotId: lot.id, cents: lot.remaining_cents });
    }
    return results;
  });

  const forfeitedCents = forfeited.reduce((s, l) => s + l.cents, 0);
  if (forfeited.length > 0) {
    void writeAudit(sql, {
      action: 'credit.forfeited',
      actorUserId: args?.actorUserId ?? null,
      meta: { userId, forfeitedCents, lotCount: forfeited.length, reason: args?.reason ?? 'account_deleted' },
    });
  }
  return { forfeitedCents, lotCount: forfeited.length };
}

// ── Expiry sweep (daily tick) ────────────────────────────────────────────────

/**
 * Zero overdue positive remainders via 'expiry' entries. Lazy expiry — lots
 * past expires_at are already unspendable (partitionSpendable skips them);
 * this makes the books match. Idempotent: an expired lot has remaining 0.
 */
export async function expireOverdueLots(
  sql: Sql,
): Promise<{ expiredLots: number; expiredCents: number }> {
  const expired = await sql.begin(async (tx) => {
    const lots = await tx<{ id: string; user_id: string; remaining_cents: number; kind: string }[]>`
      SELECT id, user_id, remaining_cents, kind FROM public.credit_lots
      WHERE remaining_cents > 0 AND expires_at IS NOT NULL AND expires_at <= now()
      ORDER BY expires_at ASC
      LIMIT 500
      FOR UPDATE
    `;
    for (const lot of lots) {
      await tx`UPDATE public.credit_lots SET remaining_cents = 0 WHERE id = ${lot.id}`;
      await tx`
        INSERT INTO public.credit_entries (user_id, kind, amount_cents, lot_id, meta)
        VALUES (${lot.user_id}, 'expiry', ${-lot.remaining_cents}, ${lot.id}, ${tx.json({})})
      `;
    }
    return lots;
  });

  for (const lot of expired) {
    void writeAudit(sql, {
      action: 'credit.expired',
      meta: { lotId: lot.id, userId: lot.user_id, lotKind: lot.kind, amountCents: lot.remaining_cents },
    });
  }
  return { expiredLots: expired.length, expiredCents: expired.reduce((s, l) => s + l.remaining_cents, 0) };
}

/**
 * Expiry nudges at 7d and 1d out, routed through the registry
 * (`credit_expiry_reminder`, seeded with a 60-minute delay precisely so the
 * queue's dedup_key — `credit_expiry:<lotId>:<window>` — enforces
 * once-per-lot-per-window across daily ticks).
 */
export async function sendCreditExpiryNudges(sql: Sql): Promise<{ queued: number }> {
  const lots = await sql<{ id: string; user_id: string; remaining_cents: number; expires_at: string }[]>`
    SELECT id, user_id, remaining_cents, expires_at
    FROM public.credit_lots
    WHERE remaining_cents > 0 AND expires_at IS NOT NULL
      AND expires_at > now() AND expires_at <= now() + interval '7 days'
    ORDER BY expires_at ASC
    LIMIT 500
  `;

  let queued = 0;
  for (const lot of lots) {
    const msLeft = new Date(lot.expires_at).getTime() - Date.now();
    const window = msLeft <= 86_400_000 ? '1d' : '7d';
    const when = window === '1d'
      ? 'tomorrow'
      : `on ${new Date(lot.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    const r = await sendNotification(sql, 'credit_expiry_reminder', lot.user_id, {
      vars: { amount: money(lot.remaining_cents), when },
      data: { type: 'credit_expiry_reminder', lotId: lot.id },
      dedupKey: `credit_expiry:${lot.id}:${window}`,
    });
    if (r.status === 'queued' || r.status === 'sent') queued++;
  }
  return { queued };
}
