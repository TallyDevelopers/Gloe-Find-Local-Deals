import type { Sql } from '../db/client';

export class TierOverlapError extends Error {
  constructor(public readonly conflictingLabel: string) {
    super(`Range overlaps with existing active tier "${conflictingLabel}".`);
    this.name = 'TierOverlapError';
  }
}

export interface TierRow {
  id: string;
  label: string;
  minCents: number;
  maxCents: number | null;
  percentBps: number;
  flatCents: number;
  vendorId: string | null;
  active: boolean;
  createdAt: string;
}

interface TierWriteInput {
  label: string;
  minCents: number;
  maxCents: number | null;
  /** Pass percentBps OR flatCents (one or the other, never both). */
  percentBps?: number;
  flatCents?: number;
  vendorId: string | null;
}

/** All tiers (active first), for the admin editor. */
export async function listTiers(sql: Sql, vendorId: string | null): Promise<TierRow[]> {
  const rows = await sql<{
    id: string;
    label: string;
    min_cents: number;
    max_cents: number | null;
    percent_bps: number;
    flat_cents: number;
    vendor_id: string | null;
    active: boolean;
    created_at: string;
  }[]>`
    SELECT id, label, min_cents, max_cents, percent_bps, flat_cents, vendor_id, active, created_at
    FROM public.platform_fees
    WHERE vendor_id IS NOT DISTINCT FROM ${vendorId}
    ORDER BY active DESC, min_cents ASC, COALESCE(max_cents, 2147483647) ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    minCents: r.min_cents,
    maxCents: r.max_cents,
    percentBps: r.percent_bps,
    flatCents: r.flat_cents,
    vendorId: r.vendor_id,
    active: r.active,
    createdAt: r.created_at,
  }));
}

/**
 * Check whether a proposed tier range overlaps with any active tier in the
 * same scope (global if vendorId is null; per-vendor otherwise). Used by
 * upsertTier — we never silently allow overlapping active ranges.
 *
 * Ranges are [min, max). max = NULL means "open-ended".
 * Two ranges overlap iff: !(a.max <= b.min || b.max <= a.min) with NULL-as-∞.
 */
async function findOverlap(
  sql: Sql,
  vendorId: string | null,
  minCents: number,
  maxCents: number | null,
  excludeId: string | null,
): Promise<string | null> {
  const rows = await sql<{ label: string }[]>`
    SELECT label FROM public.platform_fees
    WHERE active = true
      AND vendor_id IS NOT DISTINCT FROM ${vendorId}
      AND id IS DISTINCT FROM ${excludeId}
      -- existing.max > new.min  (or existing is open-ended)
      AND (max_cents IS NULL OR max_cents > ${minCents})
      -- existing.min < new.max  (or new is open-ended)
      AND (${maxCents}::int IS NULL OR min_cents < ${maxCents})
    LIMIT 1
  `;
  return rows[0]?.label ?? null;
}

function validateTierInput(input: TierWriteInput): void {
  if (input.minCents < 0) throw new Error('minCents must be ≥ 0.');
  if (input.maxCents != null && input.maxCents <= input.minCents) {
    throw new Error('maxCents must be greater than minCents.');
  }
  const hasPercent = (input.percentBps ?? 0) > 0;
  const hasFlat = (input.flatCents ?? 0) > 0;
  if (hasPercent === hasFlat) {
    throw new Error('Tier must be either a percentage OR a flat fee (not both, not neither).');
  }
  if (hasPercent && (input.percentBps! < 0 || input.percentBps! > 5000)) {
    throw new Error('percentBps must be between 0 and 5000 (0-50%).');
  }
}

/**
 * Create a new tier. Refuses to save if the active range overlaps an
 * existing active tier in the same scope.
 */
export async function createTier(sql: Sql, input: TierWriteInput): Promise<TierRow> {
  validateTierInput(input);
  const conflict = await findOverlap(sql, input.vendorId, input.minCents, input.maxCents, null);
  if (conflict) throw new TierOverlapError(conflict);

  const rows = await sql<{ id: string; created_at: string }[]>`
    INSERT INTO public.platform_fees (
      label, min_cents, max_cents, percent_bps, flat_cents, vendor_id, active
    ) VALUES (
      ${input.label}, ${input.minCents}, ${input.maxCents},
      ${input.percentBps ?? 0}, ${input.flatCents ?? 0}, ${input.vendorId}, true
    )
    RETURNING id, created_at
  `;
  return {
    id: rows[0]!.id,
    label: input.label,
    minCents: input.minCents,
    maxCents: input.maxCents,
    percentBps: input.percentBps ?? 0,
    flatCents: input.flatCents ?? 0,
    vendorId: input.vendorId,
    active: true,
    createdAt: rows[0]!.created_at,
  };
}

/**
 * Edit an existing tier in place. Refuses overlap with OTHER active tiers
 * (passes `excludeId = id` so a tier doesn't conflict with itself).
 *
 * Historical bookings are unaffected — their fee math is frozen in
 * `transactions.platform_fee_snapshot`, not re-read from this row.
 */
export async function updateTier(sql: Sql, id: string, input: TierWriteInput): Promise<void> {
  validateTierInput(input);
  const existing = await sql<{ active: boolean; vendor_id: string | null }[]>`
    SELECT active, vendor_id FROM public.platform_fees WHERE id = ${id} LIMIT 1
  `;
  const e = existing[0];
  if (!e) throw new Error('Tier not found.');
  if (e.vendor_id !== input.vendorId) {
    // Disallow moving a tier between global and per-vendor scope. If you
    // need that, deactivate + recreate — keeps history honest.
    throw new Error('Cannot change a tier between global and per-vendor scope.');
  }
  if (e.active) {
    const conflict = await findOverlap(sql, input.vendorId, input.minCents, input.maxCents, id);
    if (conflict) throw new TierOverlapError(conflict);
  }
  await sql`
    UPDATE public.platform_fees
    SET label = ${input.label},
        min_cents = ${input.minCents},
        max_cents = ${input.maxCents},
        percent_bps = ${input.percentBps ?? 0},
        flat_cents = ${input.flatCents ?? 0},
        updated_at = now()
    WHERE id = ${id}
  `;
}

/** Mark a tier inactive — keeps history but stops it from matching. */
export async function deactivateTier(sql: Sql, id: string): Promise<void> {
  await sql`
    UPDATE public.platform_fees SET active = false, updated_at = now()
    WHERE id = ${id}
  `;
}

/** Re-activate a tier. Refuses if it would overlap with another active tier. */
export async function reactivateTier(sql: Sql, id: string): Promise<void> {
  const tierRows = await sql<{
    vendor_id: string | null;
    min_cents: number;
    max_cents: number | null;
    label: string;
  }[]>`
    SELECT vendor_id, min_cents, max_cents, label FROM public.platform_fees WHERE id = ${id} LIMIT 1
  `;
  const t = tierRows[0];
  if (!t) throw new Error('Tier not found.');
  const conflict = await findOverlap(sql, t.vendor_id, t.min_cents, t.max_cents, id);
  if (conflict) throw new TierOverlapError(conflict);
  await sql`
    UPDATE public.platform_fees SET active = true, updated_at = now()
    WHERE id = ${id}
  `;
}

export interface FeeBreakdown {
  consumerPaidCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
  platformFeeId: string | null;
  /** Snapshot of the fee rule applied, stored on the transaction (JSON-safe). */
  snapshot: { label: string; percentBps: number; flatCents?: number; minFeeCents?: number };
}

/**
 * Computes the platform fee for a price using the active platform_fees tiers.
 *
 * Selection order:
 *   1. Vendor-specific tiers (platform_fees.vendor_id = vendorId), if any match.
 *   2. Global tiers (vendor_id IS NULL).
 * Within the chosen set, the highest matching `min_cents` wins.
 *
 * Tier match: min_cents <= price < max_cents (max null = open-ended top tier).
 * Fee = flat_cents if set, else percent_bps of price, then floored at
 * min_fee_cents. Vendor payout = price − fee.
 */
export async function computeFee(
  sql: Sql,
  priceCents: number,
  vendorId?: string,
): Promise<FeeBreakdown> {
  const rows = await sql<{
    id: string;
    label: string;
    min_cents: number;
    max_cents: number | null;
    percent_bps: number;
    flat_cents: number;
    min_fee_cents: number;
    is_override: boolean;
  }[]>`
    SELECT id, label, min_cents, max_cents, percent_bps, flat_cents, min_fee_cents,
           (vendor_id IS NOT NULL) AS is_override
    FROM public.platform_fees
    WHERE active = true
      AND (vendor_id IS NULL OR vendor_id = ${vendorId ?? null})
      AND ${priceCents} >= min_cents
      AND (max_cents IS NULL OR ${priceCents} < max_cents)
    -- Vendor override wins over global; then highest min_cents.
    ORDER BY is_override DESC, min_cents DESC
    LIMIT 1
  `;
  const tier = rows[0];

  let feeCents: number;
  if (!tier) {
    // No tier configured — safe default 12% so we never undercharge to $0.
    feeCents = Math.round(priceCents * 0.12);
  } else {
    feeCents = tier.flat_cents > 0 ? tier.flat_cents : Math.round((priceCents * tier.percent_bps) / 10000);
    if (tier.min_fee_cents > 0) feeCents = Math.max(feeCents, tier.min_fee_cents);
  }
  // Never exceed the price.
  feeCents = Math.min(feeCents, priceCents);

  return {
    consumerPaidCents: priceCents,
    platformFeeCents: feeCents,
    vendorPayoutCents: priceCents - feeCents,
    platformFeeId: tier?.id ?? null,
    snapshot: tier
      ? { label: tier.label, percentBps: tier.percent_bps, flatCents: tier.flat_cents, minFeeCents: tier.min_fee_cents }
      : { label: 'default', percentBps: 1200 },
  };
}
