import type { Sql, TxSql } from '../db/client';
import { writeAudit } from './audit';
import { STRIPE_MIN_CHARGE_CENTS } from './credits';
import { computeFee, type FeeBreakdown } from './fees';

/**
 * Deal promos (GLO-44) — "Extra $X off" placed ON a deal.
 *
 * A promo is a public discount line attached to the deal: everyone browsing
 * sees the badge, and the discount applies itself at checkout — before
 * credits, which auto-apply to the remainder. One active promo per deal
 * (DB-enforced). Distinct from wallet credits (GLO-24), which are personal
 * money that follows the customer.
 *
 * The funding source decides the payout math — see pricePromoOrder.
 */

type Db = Sql | TxSql;

export type PromoFundedBy = 'platform' | 'vendor';

/**
 * Pricing-claims hygiene (Apple/FTC): a promo may never push the effective
 * price below this fraction of the variant's ORIGINAL price. A huge "extra
 * off" on top of an already-discounted deal makes the reference price look
 * fictitious — total claimed discount is capped at 90%.
 */
const MIN_EFFECTIVE_PRICE_FRACTION_OF_ORIGINAL = 0.1;

export interface DealPromoRow {
  id: string;
  dealId: string;
  amountCents: number;
  fundedBy: PromoFundedBy;
  label: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdByRole: 'admin' | 'vendor';
  createdAt: string;
  endedAt: string | null;
}

/** What deal cards / detail pages get. Funding is intentionally not public. */
export interface PublicDealPromo {
  id: string;
  amountCents: number;
  /** Custom override, or null → clients render the auto copy ("Extra $X off"). */
  label: string | null;
  endsAt: string;
}

function money(cents: number): string {
  return '$' + (cents % 100 === 0 ? (cents / 100).toString() : (cents / 100).toFixed(2));
}

/** The auto badge copy. Shared by receipts/emails; clients mirror it. */
export function promoAutoLabel(amountCents: number): string {
  return `Extra ${money(amountCents)} off`;
}

// ── Checkout pricing ─────────────────────────────────────────────────────────

export interface PromoApplication {
  promoId: string;
  fundedBy: PromoFundedBy;
  /** Effective discount on THIS order (clamped to the Stripe floor), once per order. */
  discountCents: number;
}

export interface PromoPricedOrder {
  /** Fee breakdown the transaction row records. consumerPaidCents is the
   *  fee/payout basis: the ORIGINAL total for platform-funded promos (vendor
   *  made whole), the DISCOUNTED total for vendor-funded ones. */
  fee: FeeBreakdown;
  promo: PromoApplication | null;
  /** What the customer owes before credits — always baseTotal − discount. */
  chargeBaseCents: number;
}

/**
 * Resolve the deal's live promo (if any) and compute the order's money shape.
 *
 *   platform : fee on the original total; vendor payout unchanged; the
 *              discount only shrinks the cash charge (the credits pattern —
 *              the gap is funded from the platform's Stripe balance, same
 *              plumbing as credit-covered orders).
 *   vendor   : the sale is AT the discounted price — fee on it, payout =
 *              discounted − fee(discounted). consumer_paid_cents follows.
 *
 * The discount applies once per order (DoorDash item-promo model) and is
 * clamped so the pre-credit remainder never lands in Stripe's unchargeable
 * $0.01–$0.49 band. Credits may still take the remainder to exactly $0.
 */
export async function pricePromoOrder(
  sql: Sql,
  args: { dealId: string; vendorId: string; baseTotalCents: number },
): Promise<PromoPricedOrder> {
  const promoRow = await getActivePromo(sql, args.dealId);
  const discountCents = promoRow
    ? Math.max(0, Math.min(promoRow.amountCents, args.baseTotalCents - STRIPE_MIN_CHARGE_CENTS))
    : 0;

  if (!promoRow || discountCents === 0) {
    const fee = await computeFee(sql, args.baseTotalCents, args.vendorId);
    return { fee, promo: null, chargeBaseCents: args.baseTotalCents };
  }

  const chargeBaseCents = args.baseTotalCents - discountCents;
  const feeBasis = promoRow.fundedBy === 'platform' ? args.baseTotalCents : chargeBaseCents;
  const fee = await computeFee(sql, feeBasis, args.vendorId);
  return {
    fee,
    promo: { promoId: promoRow.id, fundedBy: promoRow.fundedBy, discountCents },
    chargeBaseCents,
  };
}

/** The deal's single live promo (active flag + window), or null. */
export async function getActivePromo(sql: Db, dealId: string): Promise<DealPromoRow | null> {
  const rows = await sql<RawPromoRow[]>`
    SELECT id, deal_id, amount_cents, funded_by, label, starts_at, ends_at,
           active, created_by_role, created_at, ended_at
    FROM public.deal_promos
    WHERE deal_id = ${dealId} AND active = true
      AND starts_at <= now() AND ends_at > now()
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export interface CreatePromoInput {
  dealId: string;
  amountCents: number;
  fundedBy: PromoFundedBy;
  label?: string | null;
  /** Defaults to now. */
  startsAt?: string | null;
  endsAt: string;
  actorUserId: string;
  actorRole: 'admin' | 'vendor';
}

/**
 * Create a promo on a deal. v1 ownership is clean: admins create
 * platform-funded, vendors create vendor-funded (callers enforce deal
 * ownership for vendors). Guards:
 *   - one active promo per deal (unique index; checked here for a clean error)
 *   - amount must leave every variant chargeable (≥ 50¢ after discount)
 *   - effective price stays ≥ 10% of the original price (pricing-claims hygiene)
 */
export async function createDealPromo(sql: Sql, input: CreatePromoInput): Promise<DealPromoRow> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error('Promo amount must be a positive whole number of cents.');
  }
  if (input.actorRole === 'admin' && input.fundedBy !== 'platform') {
    throw new Error('Admins create platform-funded promos. Vendors boost their own deals.');
  }
  if (input.actorRole === 'vendor' && input.fundedBy !== 'vendor') {
    throw new Error('Vendors can only create vendor-funded promos.');
  }
  if (new Date(input.endsAt).getTime() <= Date.now()) {
    throw new Error('End date must be in the future.');
  }
  const label = input.label?.trim() || null;
  if (label && label.length > 40) throw new Error('Label must be 40 characters or fewer.');

  const dealRows = await sql<{ id: string; vendor_id: string; status: string }[]>`
    SELECT id, vendor_id, status FROM public.deals WHERE id = ${input.dealId} LIMIT 1
  `;
  const deal = dealRows[0];
  if (!deal) throw new Error('Deal not found.');
  if (deal.status !== 'active') throw new Error('Promos can only be placed on live deals.');

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM public.deal_promos WHERE deal_id = ${input.dealId} AND active = true LIMIT 1
  `;
  if (existing[0]) {
    throw new Error('This deal already has a live promo. End it first — promos don\'t stack.');
  }

  // Validate against every active variant: each must stay chargeable and
  // keep an honest reference price after the discount.
  const variants = await sql<{ deal_price_cents: number; original_price_cents: number }[]>`
    SELECT deal_price_cents, original_price_cents
    FROM public.deal_variants WHERE deal_id = ${input.dealId} AND active = true
  `;
  if (variants.length === 0) throw new Error('Deal has no active pricing options.');
  for (const v of variants) {
    if (input.amountCents > v.deal_price_cents - STRIPE_MIN_CHARGE_CENTS) {
      throw new Error(
        `Promo is too large — the ${money(v.deal_price_cents)} option must stay above ${money(STRIPE_MIN_CHARGE_CENTS)}.`,
      );
    }
    const minEffective = Math.ceil(v.original_price_cents * MIN_EFFECTIVE_PRICE_FRACTION_OF_ORIGINAL);
    if (v.deal_price_cents - input.amountCents < minEffective) {
      throw new Error(
        `Promo is too large — the total discount on the ${money(v.original_price_cents)} option can't exceed 90%.`,
      );
    }
  }

  const rows = await sql<RawPromoRow[]>`
    INSERT INTO public.deal_promos (
      deal_id, amount_cents, funded_by, label, starts_at, ends_at,
      created_by, created_by_role
    ) VALUES (
      ${input.dealId}, ${input.amountCents}, ${input.fundedBy}, ${label},
      ${input.startsAt ?? sql`now()`}, ${input.endsAt},
      ${input.actorUserId}, ${input.actorRole}
    )
    RETURNING id, deal_id, amount_cents, funded_by, label, starts_at, ends_at,
              active, created_by_role, created_at, ended_at
  `;
  const promo = mapRow(rows[0]!);

  void writeAudit(sql, {
    action: 'deal_promo.created',
    actorUserId: input.actorUserId,
    vendorId: deal.vendor_id,
    meta: {
      promoId: promo.id,
      dealId: input.dealId,
      amountCents: input.amountCents,
      fundedBy: input.fundedBy,
      label,
      endsAt: input.endsAt,
      actorRole: input.actorRole,
    },
  });
  return promo;
}

/**
 * End a promo (active=false, slot freed). Idempotent. Vendors can only end
 * their own (callers enforce ownership); admins can end any.
 */
export async function endDealPromo(
  sql: Sql,
  promoId: string,
  actor: { userId: string; role: 'admin' | 'vendor' },
): Promise<void> {
  const rows = await sql<{ deal_id: string; vendor_id: string }[]>`
    UPDATE public.deal_promos p
    SET active = false, ended_at = COALESCE(p.ended_at, now()), updated_at = now()
    FROM public.deals d
    WHERE p.id = ${promoId} AND d.id = p.deal_id
    RETURNING p.deal_id, d.vendor_id
  `;
  const r = rows[0];
  if (!r) throw new Error('Promo not found.');

  void writeAudit(sql, {
    action: 'deal_promo.ended',
    actorUserId: actor.userId,
    vendorId: r.vendor_id,
    meta: { promoId, dealId: r.deal_id, actorRole: actor.role },
  });
}

// ── Listings ─────────────────────────────────────────────────────────────────

export interface DealPromoListItem extends DealPromoRow {
  dealTitle: string;
  vendorId: string;
  vendorName: string;
  /** Live = active flag on AND window currently open. */
  isLive: boolean;
  /** Orders that actually carried this promo (paid or later). */
  orderCount: number;
  /** SUM of recorded per-order discounts — the true cost-to-date. */
  costToDateCents: number;
}

/**
 * Promos with cost-to-date, newest first. Scope to one vendor for the vendor
 * dashboard; unscoped for god mode. Cost = SUM(promo_discount_cents) over
 * transactions that reached paid (refunds don't un-spend a promo).
 */
export async function listDealPromos(
  sql: Sql,
  opts: { vendorId?: string; dealId?: string; includeEnded?: boolean } = {},
): Promise<DealPromoListItem[]> {
  const rows = await sql<(RawPromoRow & {
    deal_title: string;
    vendor_id: string;
    vendor_name: string;
    order_count: number;
    cost_to_date_cents: number;
  })[]>`
    SELECT p.id, p.deal_id, p.amount_cents, p.funded_by, p.label, p.starts_at,
           p.ends_at, p.active, p.created_by_role, p.created_at, p.ended_at,
           d.title AS deal_title, d.vendor_id, v.business_name AS vendor_name,
           COALESCE(t.order_count, 0)::int AS order_count,
           COALESCE(t.cost_cents, 0)::int AS cost_to_date_cents
    FROM public.deal_promos p
    JOIN public.deals d ON d.id = p.deal_id
    JOIN public.vendors v ON v.id = d.vendor_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS order_count, SUM(t.promo_discount_cents) AS cost_cents
      FROM public.transactions t
      WHERE t.deal_promo_id = p.id
        AND t.status IN ('paid', 'released', 'partially_refunded', 'refunded', 'disputed')
    ) t ON true
    WHERE true
      ${opts.vendorId ? sql`AND d.vendor_id = ${opts.vendorId}` : sql``}
      ${opts.dealId ? sql`AND p.deal_id = ${opts.dealId}` : sql``}
      ${opts.includeEnded ? sql`` : sql`AND p.active = true`}
    ORDER BY p.created_at DESC
    LIMIT 200
  `;
  return rows.map((r) => ({
    ...mapRow(r),
    dealTitle: r.deal_title,
    vendorId: r.vendor_id,
    vendorName: r.vendor_name,
    isLive: r.active && new Date(r.starts_at).getTime() <= Date.now() && new Date(r.ends_at).getTime() > Date.now(),
    orderCount: r.order_count,
    costToDateCents: r.cost_to_date_cents,
  }));
}

/**
 * Vendor-facing payout preview for "Boost this deal" — the trade shown
 * plainly before they confirm: "you'll receive $X instead of $Y" per variant.
 */
export async function previewVendorBoost(
  sql: Sql,
  args: { dealId: string; vendorId: string; amountCents: number },
): Promise<Array<{
  variantLabel: string;
  dealPriceCents: number;
  promoPriceCents: number;
  payoutNowCents: number;
  payoutWithBoostCents: number;
}>> {
  const variants = await sql<{ label: string; deal_price_cents: number }[]>`
    SELECT dv.label, dv.deal_price_cents
    FROM public.deal_variants dv
    JOIN public.deals d ON d.id = dv.deal_id
    WHERE dv.deal_id = ${args.dealId} AND d.vendor_id = ${args.vendorId} AND dv.active = true
    ORDER BY dv.display_order, dv.label
  `;
  const out = [];
  for (const v of variants) {
    const promoPrice = Math.max(STRIPE_MIN_CHARGE_CENTS, v.deal_price_cents - args.amountCents);
    const [now, boosted] = await Promise.all([
      computeFee(sql, v.deal_price_cents, args.vendorId),
      computeFee(sql, promoPrice, args.vendorId),
    ]);
    out.push({
      variantLabel: v.label,
      dealPriceCents: v.deal_price_cents,
      promoPriceCents: promoPrice,
      payoutNowCents: now.vendorPayoutCents,
      payoutWithBoostCents: boosted.vendorPayoutCents,
    });
  }
  return out;
}

// ── Internals ────────────────────────────────────────────────────────────────

interface RawPromoRow {
  id: string;
  deal_id: string;
  amount_cents: number;
  funded_by: PromoFundedBy;
  label: string | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_by_role: 'admin' | 'vendor';
  created_at: string;
  ended_at: string | null;
}

function mapRow(r: RawPromoRow): DealPromoRow {
  return {
    id: r.id,
    dealId: r.deal_id,
    amountCents: r.amount_cents,
    fundedBy: r.funded_by,
    label: r.label,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    createdByRole: r.created_by_role,
    createdAt: r.created_at,
    endedAt: r.ended_at,
  };
}
