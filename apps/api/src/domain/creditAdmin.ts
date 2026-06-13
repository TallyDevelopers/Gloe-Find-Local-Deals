import type { Sql } from '../db/client';
import { writeAudit } from './audit';
import { grantCredit } from './credits';

/**
 * God-mode surface for the credits platform (GLO-24): rules CRUD (the
 * platform_fees pattern — soft-delete via active, never DELETE), push-credit
 * campaigns, per-user ledger lookup with manual grant/revoke, and the program
 * dashboard numbers. All grants still go through `grantCredit()` — the one
 * door in domain/credits.ts; nothing here inserts lots directly.
 */

export class CreditRuleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreditRuleConflictError';
  }
}

export type CreditRuleType = 'purchase_tier' | 'referral' | 'signup_bonus';

export interface CreditRuleRow {
  id: string;
  ruleType: CreditRuleType;
  minPurchaseCents: number | null;
  maxPurchaseCents: number | null;
  creditCents: number | null;
  percentBps: number | null;
  giveCents: number | null;
  getCents: number | null;
  minFirstPurchaseCents: number | null;
  expiresAfterDays: number;
  monthlyUserCapCents: number | null;
  monthlyReferralPayoutCap: number | null;
  active: boolean;
  createdAt: string;
}

export interface CreditRuleWriteInput {
  ruleType: CreditRuleType;
  minPurchaseCents?: number | null;
  maxPurchaseCents?: number | null;
  creditCents?: number | null;
  percentBps?: number | null;
  giveCents?: number | null;
  getCents?: number | null;
  minFirstPurchaseCents?: number | null;
  expiresAfterDays: number;
  monthlyUserCapCents?: number | null;
  monthlyReferralPayoutCap?: number | null;
  /** Create-only: seed a rule OFF (the launch posture for tiers/signup). */
  active?: boolean;
}

interface RuleDbRow {
  id: string;
  rule_type: CreditRuleType;
  min_purchase_cents: number | null;
  max_purchase_cents: number | null;
  credit_cents: number | null;
  percent_bps: number | null;
  give_cents: number | null;
  get_cents: number | null;
  min_first_purchase_cents: number | null;
  expires_after_days: number;
  monthly_user_cap_cents: number | null;
  monthly_referral_payout_cap: number | null;
  active: boolean;
  created_at: string;
}

function mapRule(r: RuleDbRow): CreditRuleRow {
  return {
    id: r.id,
    ruleType: r.rule_type,
    minPurchaseCents: r.min_purchase_cents,
    maxPurchaseCents: r.max_purchase_cents,
    creditCents: r.credit_cents,
    percentBps: r.percent_bps,
    giveCents: r.give_cents,
    getCents: r.get_cents,
    minFirstPurchaseCents: r.min_first_purchase_cents,
    expiresAfterDays: r.expires_after_days,
    monthlyUserCapCents: r.monthly_user_cap_cents,
    monthlyReferralPayoutCap: r.monthly_referral_payout_cap,
    active: r.active,
    createdAt: r.created_at,
  };
}

/** All rules (active first), grouped sensibly for the admin editor. */
export async function listCreditRules(sql: Sql): Promise<CreditRuleRow[]> {
  const rows = await sql<RuleDbRow[]>`
    SELECT id, rule_type, min_purchase_cents, max_purchase_cents, credit_cents, percent_bps,
           give_cents, get_cents, min_first_purchase_cents, expires_after_days,
           monthly_user_cap_cents, monthly_referral_payout_cap, active, created_at
    FROM public.credit_rules
    ORDER BY rule_type ASC, active DESC, COALESCE(min_purchase_cents, 0) ASC, created_at ASC
  `;
  return rows.map(mapRule);
}

function validateRuleInput(input: CreditRuleWriteInput): void {
  if (input.expiresAfterDays < 1) throw new Error('Expiry must be at least 1 day.');
  if (input.ruleType === 'purchase_tier') {
    if (input.minPurchaseCents == null || input.minPurchaseCents < 0) {
      throw new Error('Purchase tiers need a minimum purchase amount.');
    }
    if (input.maxPurchaseCents != null && input.maxPurchaseCents <= input.minPurchaseCents) {
      throw new Error('Max purchase must be greater than min.');
    }
    const hasCents = (input.creditCents ?? 0) > 0;
    const hasBps = (input.percentBps ?? 0) > 0;
    if (hasCents === hasBps) {
      throw new Error('A tier rewards either flat credit OR a percent of the order (not both, not neither).');
    }
    if (hasBps && input.percentBps! > 10000) throw new Error('Percent cannot exceed 100%.');
  }
  if (input.ruleType === 'referral') {
    if ((input.giveCents ?? 0) <= 0 || (input.getCents ?? 0) <= 0) {
      throw new Error('Referral rules need both a give amount (referee) and a get amount (referrer).');
    }
  }
  if (input.ruleType === 'signup_bonus') {
    if ((input.creditCents ?? 0) <= 0) throw new Error('Signup bonus needs a credit amount.');
  }
}

/**
 * Refuse a rule configuration that would fight another ACTIVE rule:
 * purchase tiers may not overlap ranges (the platform_fees semantics);
 * referral and signup_bonus are singletons — one active row at a time.
 */
async function findRuleConflict(
  sql: Sql,
  ruleType: CreditRuleType,
  minPurchaseCents: number | null,
  maxPurchaseCents: number | null,
  excludeId: string | null,
): Promise<string | null> {
  if (ruleType === 'purchase_tier') {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM public.credit_rules
      WHERE active = true AND rule_type = 'purchase_tier'
        AND id IS DISTINCT FROM ${excludeId}
        AND (max_purchase_cents IS NULL OR max_purchase_cents > ${minPurchaseCents ?? 0})
        AND (${maxPurchaseCents}::int IS NULL OR COALESCE(min_purchase_cents, 0) < ${maxPurchaseCents})
      LIMIT 1
    `;
    return rows[0] ? 'Range overlaps another active purchase tier. Deactivate or edit that one first.' : null;
  }
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM public.credit_rules
    WHERE active = true AND rule_type = ${ruleType}
      AND id IS DISTINCT FROM ${excludeId}
    LIMIT 1
  `;
  return rows[0]
    ? `Only one ${ruleType === 'referral' ? 'referral' : 'signup bonus'} rule can be active at a time. Deactivate the current one first.`
    : null;
}

export async function createCreditRule(sql: Sql, input: CreditRuleWriteInput): Promise<CreditRuleRow> {
  validateRuleInput(input);
  const active = input.active ?? true;
  if (active) {
    const conflict = await findRuleConflict(
      sql, input.ruleType, input.minPurchaseCents ?? null, input.maxPurchaseCents ?? null, null,
    );
    if (conflict) throw new CreditRuleConflictError(conflict);
  }
  const rows = await sql<RuleDbRow[]>`
    INSERT INTO public.credit_rules (
      rule_type, min_purchase_cents, max_purchase_cents, credit_cents, percent_bps,
      give_cents, get_cents, min_first_purchase_cents, expires_after_days,
      monthly_user_cap_cents, monthly_referral_payout_cap, active
    ) VALUES (
      ${input.ruleType}, ${input.minPurchaseCents ?? null}, ${input.maxPurchaseCents ?? null},
      ${input.creditCents ?? null}, ${input.percentBps ?? null},
      ${input.giveCents ?? null}, ${input.getCents ?? null}, ${input.minFirstPurchaseCents ?? null},
      ${input.expiresAfterDays}, ${input.monthlyUserCapCents ?? null},
      ${input.monthlyReferralPayoutCap ?? null}, ${active}
    )
    RETURNING id, rule_type, min_purchase_cents, max_purchase_cents, credit_cents, percent_bps,
              give_cents, get_cents, min_first_purchase_cents, expires_after_days,
              monthly_user_cap_cents, monthly_referral_payout_cap, active, created_at
  `;
  return mapRule(rows[0]!);
}

/**
 * Edit a rule in place. The rule's type is fixed for life (deactivate +
 * recreate to change shape — keeps lot.rule_id history honest). Past grants
 * are untouched: lots carry their own amounts and expiries.
 */
export async function updateCreditRule(sql: Sql, id: string, input: CreditRuleWriteInput): Promise<CreditRuleRow> {
  validateRuleInput(input);
  const existing = await sql<{ rule_type: CreditRuleType; active: boolean }[]>`
    SELECT rule_type, active FROM public.credit_rules WHERE id = ${id} LIMIT 1
  `;
  const e = existing[0];
  if (!e) throw new Error('Rule not found.');
  if (e.rule_type !== input.ruleType) {
    throw new Error('Cannot change a rule\'s type. Deactivate it and create a new one.');
  }
  if (e.active) {
    const conflict = await findRuleConflict(
      sql, input.ruleType, input.minPurchaseCents ?? null, input.maxPurchaseCents ?? null, id,
    );
    if (conflict) throw new CreditRuleConflictError(conflict);
  }
  const rows = await sql<RuleDbRow[]>`
    UPDATE public.credit_rules
    SET min_purchase_cents          = ${input.minPurchaseCents ?? null},
        max_purchase_cents          = ${input.maxPurchaseCents ?? null},
        credit_cents                = ${input.creditCents ?? null},
        percent_bps                 = ${input.percentBps ?? null},
        give_cents                  = ${input.giveCents ?? null},
        get_cents                   = ${input.getCents ?? null},
        min_first_purchase_cents    = ${input.minFirstPurchaseCents ?? null},
        expires_after_days          = ${input.expiresAfterDays},
        monthly_user_cap_cents      = ${input.monthlyUserCapCents ?? null},
        monthly_referral_payout_cap = ${input.monthlyReferralPayoutCap ?? null},
        updated_at                  = now()
    WHERE id = ${id}
    RETURNING id, rule_type, min_purchase_cents, max_purchase_cents, credit_cents, percent_bps,
              give_cents, get_cents, min_first_purchase_cents, expires_after_days,
              monthly_user_cap_cents, monthly_referral_payout_cap, active, created_at
  `;
  return mapRule(rows[0]!);
}

/** Turn a rule OFF — stops new grants; granted lots keep their value/expiry. */
export async function deactivateCreditRule(sql: Sql, id: string): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    UPDATE public.credit_rules SET active = false, updated_at = now() WHERE id = ${id}
    RETURNING id
  `;
  if (!rows[0]) throw new Error('Rule not found.');
}

/** Turn a rule back ON. Refuses if it would fight another active rule. */
export async function reactivateCreditRule(sql: Sql, id: string): Promise<void> {
  const rows = await sql<{
    rule_type: CreditRuleType;
    min_purchase_cents: number | null;
    max_purchase_cents: number | null;
  }[]>`
    SELECT rule_type, min_purchase_cents, max_purchase_cents
    FROM public.credit_rules WHERE id = ${id} LIMIT 1
  `;
  const r = rows[0];
  if (!r) throw new Error('Rule not found.');
  const conflict = await findRuleConflict(sql, r.rule_type, r.min_purchase_cents, r.max_purchase_cents, id);
  if (conflict) throw new CreditRuleConflictError(conflict);
  await sql`
    UPDATE public.credit_rules SET active = true, updated_at = now() WHERE id = ${id}
  `;
}

/* ── Campaigns ──────────────────────────────────────────────────────────────── */

export type CampaignAudience = 'everyone' | 'lapsed_60d' | 'signed_up_never_purchased';

export interface CreditCampaignRow {
  id: string;
  name: string;
  amountCents: number;
  expiresAfterDays: number;
  audience: CampaignAudience;
  /** Optional city drill-down (matches users.last_city). Null = anywhere. */
  audienceCity: string | null;
  messageTitle: string;
  messageBody: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  grantedCount: number;
  grantedCents: number;
  /** What the campaign actually COST so far: spent at checkout vs evaporated. */
  redeemedCents: number;
  expiredCents: number;
  createdAt: string;
  createdByEmail: string | null;
}

export async function listCreditCampaigns(sql: Sql): Promise<CreditCampaignRow[]> {
  const rows = await sql<{
    id: string;
    name: string;
    amount_cents: number;
    expires_after_days: number;
    audience: CampaignAudience;
    audience_city: string | null;
    message_title: string;
    message_body: string;
    status: 'draft' | 'sent';
    sent_at: string | null;
    granted_count: number;
    granted_cents: number;
    redeemed_cents: number;
    expired_cents: number;
    created_at: string;
    created_by_email: string | null;
  }[]>`
    SELECT
      c.id, c.name, c.amount_cents, c.expires_after_days, c.audience, c.audience_city,
      c.message_title, c.message_body, c.status, c.sent_at,
      c.granted_count, c.granted_cents, c.created_at,
      u.email AS created_by_email,
      COALESCE((SELECT SUM(-e.amount_cents) FROM public.credit_entries e
                JOIN public.credit_lots l ON l.id = e.lot_id
                WHERE l.campaign_id = c.id AND e.kind = 'redemption'), 0)::int AS redeemed_cents,
      COALESCE((SELECT SUM(-e.amount_cents) FROM public.credit_entries e
                JOIN public.credit_lots l ON l.id = e.lot_id
                WHERE l.campaign_id = c.id AND e.kind = 'expiry'), 0)::int AS expired_cents
    FROM public.credit_campaigns c
    LEFT JOIN public.users u ON u.id = c.created_by
    ORDER BY c.created_at DESC
    LIMIT 100
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amountCents: r.amount_cents,
    expiresAfterDays: r.expires_after_days,
    audience: r.audience,
    audienceCity: r.audience_city,
    messageTitle: r.message_title,
    messageBody: r.message_body,
    status: r.status,
    sentAt: r.sent_at,
    grantedCount: r.granted_count,
    grantedCents: r.granted_cents,
    redeemedCents: r.redeemed_cents,
    expiredCents: r.expired_cents,
    createdAt: r.created_at,
    createdByEmail: r.created_by_email,
  }));
}

export async function createCreditCampaign(
  sql: Sql,
  input: {
    name: string;
    amountCents: number;
    expiresAfterDays: number;
    audience: CampaignAudience;
    audienceCity?: string | null;
    messageTitle: string;
    messageBody: string;
  },
  createdBy: string,
): Promise<{ id: string }> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.credit_campaigns (
      name, amount_cents, expires_after_days, audience, audience_city,
      message_title, message_body, created_by
    ) VALUES (
      ${input.name}, ${input.amountCents}, ${input.expiresAfterDays}, ${input.audience},
      ${input.audienceCity ?? null}, ${input.messageTitle}, ${input.messageBody}, ${createdBy}
    )
    RETURNING id
  `;
  return { id: rows[0]!.id };
}

/** Drafts can be discarded; a sent campaign is history and stays. */
export async function deleteDraftCampaign(sql: Sql, campaignId: string): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM public.credit_campaigns
    WHERE id = ${campaignId} AND status = 'draft'
    RETURNING id
  `;
  if (!rows[0]) throw new Error('Campaign not found or already sent.');
}

async function resolveAudience(
  sql: Sql,
  audience: CampaignAudience,
  city: string | null = null,
): Promise<string[]> {
  // City drill-down composes with every base audience: when set, only users
  // whose last-known browsing city matches are included (NULL city users are
  // out — we genuinely don't know where they are).
  const cityFilter = city
    ? sql`AND u.last_city = ${city}`
    : sql``;
  if (audience === 'everyone') {
    const rows = await sql<{ id: string }[]>`
      SELECT u.id FROM public.users u
      WHERE u.deleted_at IS NULL ${cityFilter}
    `;
    return rows.map((r) => r.id);
  }
  if (audience === 'lapsed_60d') {
    const rows = await sql<{ id: string }[]>`
      SELECT u.id FROM public.users u
      WHERE u.deleted_at IS NULL ${cityFilter}
        AND EXISTS (SELECT 1 FROM public.transactions t
                    WHERE t.user_id = u.id AND t.paid_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM public.transactions t
                        WHERE t.user_id = u.id AND t.paid_at > now() - interval '60 days')
    `;
    return rows.map((r) => r.id);
  }
  const rows = await sql<{ id: string }[]>`
    SELECT u.id FROM public.users u
    WHERE u.deleted_at IS NULL ${cityFilter}
      AND NOT EXISTS (SELECT 1 FROM public.transactions t
                      WHERE t.user_id = u.id AND t.paid_at IS NOT NULL)
  `;
  return rows.map((r) => r.id);
}

/** Cost preview for the "review before send" step. */
export async function previewCampaignAudience(
  sql: Sql,
  audience: CampaignAudience,
  city: string | null = null,
): Promise<{ userCount: number }> {
  const ids = await resolveAudience(sql, audience, city);
  return { userCount: ids.length };
}

/**
 * Cities we actually have customers in (from last-known browse location),
 * with headcount — the drill-down picker for campaign targeting.
 */
export async function listCustomerCities(
  sql: Sql,
): Promise<Array<{ city: string; userCount: number }>> {
  const rows = await sql<{ city: string; user_count: number }[]>`
    SELECT last_city AS city, COUNT(*)::int AS user_count
    FROM public.users
    WHERE deleted_at IS NULL AND last_city IS NOT NULL
    GROUP BY last_city
    ORDER BY user_count DESC, last_city ASC
    LIMIT 100
  `;
  return rows.map((r) => ({ city: r.city, userCount: r.user_count }));
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Fire a campaign. The draft→sent flip is the idempotency wall (a double-click
 * can't double-send); each grant is additionally walled per user by the
 * (campaign_id, user_id) unique index. The grant loop runs fire-and-forget
 * with progress persisted onto the campaign row (granted_count/granted_cents),
 * so the admin list shows it filling in live.
 */
export async function sendCreditCampaign(
  sql: Sql,
  campaignId: string,
  actorUserId: string,
): Promise<{ audienceCount: number }> {
  const drafts = await sql<{
    id: string;
    name: string;
    amount_cents: number;
    expires_after_days: number;
    audience: CampaignAudience;
    audience_city: string | null;
    message_title: string;
    message_body: string;
  }[]>`
    SELECT id, name, amount_cents, expires_after_days, audience, audience_city,
           message_title, message_body
    FROM public.credit_campaigns
    WHERE id = ${campaignId} AND status = 'draft'
    LIMIT 1
  `;
  const c = drafts[0];
  if (!c) throw new Error('Campaign not found or already sent.');

  // Resolve BEFORE flipping to sent — an empty audience must not burn the draft.
  const userIds = await resolveAudience(sql, c.audience, c.audience_city);
  if (userIds.length === 0) {
    throw new Error(
      c.audience_city
        ? `No customers with a last-known location in ${c.audience_city} right now — nothing to send.`
        : 'This audience resolves to 0 customers right now — nothing to send.',
    );
  }

  const flipped = await sql<{ id: string }[]>`
    UPDATE public.credit_campaigns
    SET status = 'sent', sent_at = now()
    WHERE id = ${campaignId} AND status = 'draft'
    RETURNING id
  `;
  if (!flipped[0]) throw new Error('Campaign not found or already sent.');

  void writeAudit(sql, {
    action: 'credit_campaign.sent',
    actorUserId,
    meta: {
      campaignId: c.id,
      name: c.name,
      audience: c.audience,
      audienceCity: c.audience_city,
      audienceCount: userIds.length,
      amountCents: c.amount_cents,
      totalCostCents: c.amount_cents * userIds.length,
    },
  });

  void (async () => {
    let granted = 0;
    for (const userId of userIds) {
      try {
        const grant = await grantCredit(sql, {
          userId,
          kind: 'promo',
          amountCents: c.amount_cents,
          expiresAfterDays: c.expires_after_days,
          campaignId: c.id,
          note: c.message_title,
          actorUserId,
          notify: { title: c.message_title, body: c.message_body },
          sendEmail: true,
        });
        if (grant.granted) {
          granted++;
          await sql`
            UPDATE public.credit_campaigns
            SET granted_count = granted_count + 1,
                granted_cents = granted_cents + ${c.amount_cents}
            WHERE id = ${c.id}
          `;
        }
      } catch (e) {
        console.error(`[campaign ${c.id}] grant failed for user ${userId}:`, (e as Error).message);
      }
    }
    console.log(`[campaign ${c.id}] "${c.name}" done: ${granted}/${userIds.length} granted ${money(c.amount_cents)}`);
  })();

  return { audienceCount: userIds.length };
}

/* ── Per-user ledger lookup (manual grant / revoke) ─────────────────────────── */

export interface UserCreditLedger {
  user: {
    id: string;
    displayId: string;
    name: string | null;
    email: string | null;
    referralCode: string | null;
    creditFrozenAt: string | null;
    createdAt: string;
  };
  /** Net of every lot (clawback debt included) — the books number. */
  balanceCents: number;
  /** What they could actually spend today (positive, unexpired lots − debt). */
  availableCents: number;
  lots: Array<{
    id: string;
    kind: string;
    amountCents: number;
    remainingCents: number;
    expiresAt: string | null;
    note: string | null;
    campaignName: string | null;
    transactionId: string | null;
    minFirstPurchaseCents: number | null;
    createdAt: string;
  }>;
  entries: Array<{
    id: string;
    kind: string;
    amountCents: number;
    lotId: string;
    transactionId: string | null;
    meta: Record<string, unknown>;
    createdAt: string;
  }>;
}

export async function getCreditLedgerForUser(sql: Sql, userId: string): Promise<UserCreditLedger | null> {
  const users = await sql<{
    id: string;
    display_id: string;
    name: string | null;
    email: string | null;
    referral_code: string | null;
    credit_frozen_at: string | null;
    created_at: string;
  }[]>`
    SELECT id, display_id,
           NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '') AS name,
           email, referral_code, credit_frozen_at, created_at
    FROM public.users WHERE id = ${userId} LIMIT 1
  `;
  const u = users[0];
  if (!u) return null;

  const totals = await sql<{ balance: number; available: number }[]>`
    SELECT
      COALESCE(SUM(remaining_cents), 0)::int AS balance,
      GREATEST(0, COALESCE(SUM(CASE
        WHEN remaining_cents < 0 THEN remaining_cents
        WHEN expires_at IS NULL OR expires_at > now() THEN remaining_cents
        ELSE 0
      END), 0))::int AS available
    FROM public.credit_lots WHERE user_id = ${userId}
  `;

  const lots = await sql<{
    id: string;
    kind: string;
    amount_cents: number;
    remaining_cents: number;
    expires_at: string | null;
    note: string | null;
    campaign_name: string | null;
    transaction_id: string | null;
    min_first_purchase_cents: number | null;
    created_at: string;
  }[]>`
    SELECT l.id, l.kind, l.amount_cents, l.remaining_cents, l.expires_at, l.note,
           c.name AS campaign_name, l.transaction_id, r.min_first_purchase_cents, l.created_at
    FROM public.credit_lots l
    LEFT JOIN public.credit_campaigns c ON c.id = l.campaign_id
    LEFT JOIN public.credit_rules r ON r.id = l.rule_id
    WHERE l.user_id = ${userId}
    ORDER BY l.created_at DESC
    LIMIT 100
  `;

  const entries = await sql<{
    id: string;
    kind: string;
    amount_cents: number;
    lot_id: string;
    transaction_id: string | null;
    meta: Record<string, unknown>;
    created_at: string;
  }[]>`
    SELECT id, kind, amount_cents, lot_id, transaction_id, meta, created_at
    FROM public.credit_entries
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return {
    user: {
      id: u.id,
      displayId: u.display_id,
      name: u.name,
      email: u.email,
      referralCode: u.referral_code,
      creditFrozenAt: u.credit_frozen_at,
      createdAt: u.created_at,
    },
    balanceCents: totals[0]?.balance ?? 0,
    availableCents: totals[0]?.available ?? 0,
    lots: lots.map((l) => ({
      id: l.id,
      kind: l.kind,
      amountCents: l.amount_cents,
      remainingCents: l.remaining_cents,
      expiresAt: l.expires_at,
      note: l.note,
      campaignName: l.campaign_name,
      transactionId: l.transaction_id,
      minFirstPurchaseCents: l.min_first_purchase_cents,
      createdAt: l.created_at,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      amountCents: e.amount_cents,
      lotId: e.lot_id,
      transactionId: e.transaction_id,
      meta: e.meta,
      createdAt: e.created_at,
    })),
  };
}

/** Manual god-mode grant. Routes through the one door, pushes + emails. */
export async function adminGrantCredit(
  sql: Sql,
  args: {
    userId: string;
    amountCents: number;
    expiresAfterDays: number | null;
    note: string;
    actorUserId: string;
  },
): Promise<{ lotId: string | null; expiresAt: string | null }> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM public.users WHERE id = ${args.userId} AND deleted_at IS NULL LIMIT 1
  `;
  if (!rows[0]) throw new Error('Customer not found.');
  const grant = await grantCredit(sql, {
    userId: args.userId,
    kind: 'admin_grant',
    amountCents: args.amountCents,
    expiresAfterDays: args.expiresAfterDays,
    note: args.note,
    actorUserId: args.actorUserId,
    notify: {
      title: `${money(args.amountCents)} in Gloē credit`,
      body: 'It’s in your wallet and applies automatically at checkout.',
    },
    sendEmail: true,
  });
  if (!grant.granted) throw new Error('Grant did not apply (duplicate).');
  return { lotId: grant.lotId, expiresAt: grant.expiresAt };
}

/**
 * Manual god-mode revoke: zero a lot's REMAINING value via a clawback entry.
 * Spent credit stays spent (that purchase already happened); this only takes
 * back what hasn't been used. Audited with the reason.
 */
export async function revokeCreditLot(
  sql: Sql,
  args: { lotId: string; reason: string; actorUserId: string },
): Promise<{ revokedCents: number }> {
  const result = await sql.begin(async (tx) => {
    const lots = await tx<{ id: string; user_id: string; kind: string; remaining_cents: number }[]>`
      SELECT id, user_id, kind, remaining_cents FROM public.credit_lots
      WHERE id = ${args.lotId} LIMIT 1 FOR UPDATE
    `;
    const lot = lots[0];
    if (!lot) throw new Error('Lot not found.');
    if (lot.remaining_cents <= 0) throw new Error('Nothing left on this lot to revoke.');
    await tx`
      INSERT INTO public.credit_entries (user_id, kind, amount_cents, lot_id, meta)
      VALUES (${lot.user_id}, 'clawback', ${-lot.remaining_cents}, ${lot.id},
              ${tx.json({ manual: true, reason: args.reason })})
    `;
    await tx`
      UPDATE public.credit_lots SET remaining_cents = 0 WHERE id = ${lot.id}
    `;
    return { userId: lot.user_id, kind: lot.kind, revokedCents: lot.remaining_cents };
  });

  void writeAudit(sql, {
    action: 'credit.revoked',
    actorUserId: args.actorUserId,
    meta: {
      lotId: args.lotId,
      userId: result.userId,
      lotKind: result.kind,
      amountCents: result.revokedCents,
      reason: args.reason,
    },
  });
  return { revokedCents: result.revokedCents };
}

/* ── Program dashboard ──────────────────────────────────────────────────────── */

export interface CreditProgramStats {
  issuedCents: number;
  issuedLots: number;
  redeemedCents: number;
  clawedCents: number;
  expiredCents: number;
  forfeitedCents: number;
  /** Spendable money on the books right now (positive, unexpired remainders). */
  outstandingLiabilityCents: number;
  /** Clawback debt waiting to net against future earns. */
  debtCents: number;
  usersWithBalance: number;
  expiring30dCents: number;
  frozenUsers: number;
  byKind: Array<{ kind: string; issuedCents: number; lotCount: number }>;
}

export async function getCreditProgramStats(sql: Sql): Promise<CreditProgramStats> {
  const rows = await sql<{
    issued_cents: number;
    issued_lots: number;
    redeemed_cents: number;
    clawed_cents: number;
    expired_cents: number;
    forfeited_cents: number;
    outstanding_cents: number;
    debt_cents: number;
    users_with_balance: number;
    expiring_30d_cents: number;
    frozen_users: number;
  }[]>`
    SELECT
      COALESCE((SELECT SUM(amount_cents) FROM public.credit_lots), 0)::int AS issued_cents,
      COALESCE((SELECT COUNT(*) FROM public.credit_lots), 0)::int AS issued_lots,
      COALESCE((SELECT SUM(-amount_cents) FROM public.credit_entries WHERE kind = 'redemption'), 0)::int AS redeemed_cents,
      COALESCE((SELECT SUM(-amount_cents) FROM public.credit_entries WHERE kind = 'clawback'), 0)::int AS clawed_cents,
      COALESCE((SELECT SUM(-amount_cents) FROM public.credit_entries WHERE kind = 'expiry'), 0)::int AS expired_cents,
      COALESCE((SELECT SUM(-amount_cents) FROM public.credit_entries WHERE kind = 'forfeiture'), 0)::int AS forfeited_cents,
      COALESCE((SELECT SUM(remaining_cents) FROM public.credit_lots
                WHERE remaining_cents > 0 AND (expires_at IS NULL OR expires_at > now())), 0)::int AS outstanding_cents,
      COALESCE((SELECT SUM(-remaining_cents) FROM public.credit_lots WHERE remaining_cents < 0), 0)::int AS debt_cents,
      COALESCE((SELECT COUNT(DISTINCT user_id) FROM public.credit_lots
                WHERE remaining_cents > 0 AND (expires_at IS NULL OR expires_at > now())), 0)::int AS users_with_balance,
      COALESCE((SELECT SUM(remaining_cents) FROM public.credit_lots
                WHERE remaining_cents > 0 AND expires_at IS NOT NULL
                  AND expires_at BETWEEN now() AND now() + interval '30 days'), 0)::int AS expiring_30d_cents,
      COALESCE((SELECT COUNT(*) FROM public.users WHERE credit_frozen_at IS NOT NULL), 0)::int AS frozen_users
  `;
  const byKind = await sql<{ kind: string; issued_cents: number; lot_count: number }[]>`
    SELECT kind, COALESCE(SUM(amount_cents), 0)::int AS issued_cents, COUNT(*)::int AS lot_count
    FROM public.credit_lots
    GROUP BY kind
    ORDER BY issued_cents DESC
  `;
  const s = rows[0]!;
  return {
    issuedCents: s.issued_cents,
    issuedLots: s.issued_lots,
    redeemedCents: s.redeemed_cents,
    clawedCents: s.clawed_cents,
    expiredCents: s.expired_cents,
    forfeitedCents: s.forfeited_cents,
    outstandingLiabilityCents: s.outstanding_cents,
    debtCents: s.debt_cents,
    usersWithBalance: s.users_with_balance,
    expiring30dCents: s.expiring_30d_cents,
    frozenUsers: s.frozen_users,
    byKind: byKind.map((k) => ({ kind: k.kind, issuedCents: k.issued_cents, lotCount: k.lot_count })),
  };
}
