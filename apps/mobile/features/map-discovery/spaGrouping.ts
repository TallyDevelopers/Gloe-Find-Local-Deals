import type { DealSummary } from '@gloe/api-client';

/**
 * A spa = one vendor with at least one deal that has plottable coordinates.
 * Pins are spas; the bottom card shows the spa's headline deal plus a
 * "+N more experiences" hint when it has more than one. (GLO-25 decision:
 * one card per spa, not one per deal.)
 */
export interface SpaPin {
  vendorId: string;
  businessName: string;
  lat: number;
  lng: number;
  /** Deals at this spa, best-first (caller passes them pre-sorted by the feed). */
  deals: DealSummary[];
  /** The deal we surface on the card — the first (best-ranked) one. */
  headline: DealSummary;
}

/**
 * Collapse a flat deal list into one pin per vendor. Deals without vendor
 * coordinates can't be plotted, so they're dropped from the map (they still
 * appear in the list feed elsewhere). Order is preserved from the input so the
 * feed's ranking carries through to which spa's card shows first.
 */
export function groupDealsBySpa(deals: DealSummary[]): SpaPin[] {
  const byVendor = new Map<string, SpaPin>();
  for (const deal of deals) {
    const { lat, lng } = deal.vendor;
    if (lat == null || lng == null) continue;
    const existing = byVendor.get(deal.vendor.id);
    if (existing) {
      existing.deals.push(deal);
    } else {
      byVendor.set(deal.vendor.id, {
        vendorId: deal.vendor.id,
        businessName: deal.vendor.businessName,
        lat,
        lng,
        deals: [deal],
        headline: deal,
      });
    }
  }
  return [...byVendor.values()];
}
