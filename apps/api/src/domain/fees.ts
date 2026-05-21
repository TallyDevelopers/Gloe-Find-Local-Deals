import type { Sql } from '../db/client';

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
 * Tier match: min_cents <= price < max_cents (max null = open-ended top tier).
 * Fee = flat_cents if set, else percent_bps of price, then floored at
 * min_fee_cents. Vendor payout = price − fee. Global tiers only for now
 * (vendor_id IS NULL); per-vendor overrides can be added later.
 */
export async function computeFee(sql: Sql, priceCents: number): Promise<FeeBreakdown> {
  const rows = await sql<{
    id: string;
    label: string;
    min_cents: number;
    max_cents: number | null;
    percent_bps: number;
    flat_cents: number;
    min_fee_cents: number;
  }[]>`
    SELECT id, label, min_cents, max_cents, percent_bps, flat_cents, min_fee_cents
    FROM public.platform_fees
    WHERE active = true AND vendor_id IS NULL
      AND ${priceCents} >= min_cents
      AND (max_cents IS NULL OR ${priceCents} < max_cents)
    ORDER BY min_cents DESC
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
