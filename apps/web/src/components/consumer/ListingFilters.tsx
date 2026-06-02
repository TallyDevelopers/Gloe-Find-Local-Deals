'use client';

import type { DealSummary } from '@gloe/api-client';

import { discountPct } from './format';

/**
 * DATA-DRIVEN filters for the treatment listing. Options are derived from the
 * deals actually present in the category — an option only appears if it has
 * inventory AND segments the set (0 < count < total). So filters "pop up" as
 * services are added; nothing is hardcoded per category, and there are no
 * dead-end filters that return zero results.
 */

export type PriceKey = 'any' | 'lt100' | 'mid' | 'high' | 'gt500';

export interface ListingFilters {
  subtype: string | null;
  price: PriceKey;
  discount: number | null;
  distance: number | null;
  minRating: number | null;
}

export const DEFAULT_FILTERS: ListingFilters = {
  subtype: null,
  price: 'any',
  discount: null,
  distance: null,
  minRating: null,
};

export type GroupId = 'subtype' | 'price' | 'discount' | 'distance' | 'rating';

interface FilterOption {
  value: string | number | null;
  label: string;
  count: number | null; // null = the "Any" option (no count shown)
}
interface FilterGroup {
  id: GroupId;
  title: string;
  options: FilterOption[];
}

const PRICE_BUCKETS: { key: Exclude<PriceKey, 'any'>; label: string; test: (c: number) => boolean }[] = [
  { key: 'lt100', label: 'Under $100', test: (c) => c < 10000 },
  { key: 'mid', label: '$100 – $250', test: (c) => c >= 10000 && c < 25000 },
  { key: 'high', label: '$250 – $500', test: (c) => c >= 25000 && c < 50000 },
  { key: 'gt500', label: '$500+', test: (c) => c >= 50000 },
];
const DISCOUNT_TIERS = [20, 30, 50];
const DISTANCE_TIERS = [5, 10, 25];
const RATING_TIERS = [4, 4.5];

function dealPct(d: DealSummary): number {
  return d.headlineVariant ? discountPct(d.headlineVariant.originalPriceCents, d.headlineVariant.dealPriceCents) : 0;
}

/** Build the visible filter groups + live counts from the category's deals. */
export function buildFilterGroups(
  deals: DealSummary[],
  opts: { hasLocation: boolean; subtypes: { slug: string; displayName: string }[] },
): FilterGroup[] {
  const total = deals.length;
  if (total === 0) return [];
  const groups: FilterGroup[] = [];
  const useful = (count: number) => count > 0 && count < total; // actually segments

  // Treatment (sub-type)
  const subCounts = new Map<string, number>();
  for (const d of deals) {
    const s = d.category.subtypeSlug;
    if (s) subCounts.set(s, (subCounts.get(s) ?? 0) + 1);
  }
  const subOpts = opts.subtypes
    .map((s) => ({ value: s.slug, label: s.displayName, count: subCounts.get(s.slug) ?? 0 }))
    .filter((o) => useful(o.count));
  if (subOpts.length > 0) groups.push({ id: 'subtype', title: 'Treatment', options: [{ value: null, label: 'All', count: null }, ...subOpts] });

  // Price
  const priceOpts = PRICE_BUCKETS.map((b) => ({
    value: b.key,
    label: b.label,
    count: deals.filter((d) => d.headlineVariant != null && b.test(d.headlineVariant.dealPriceCents)).length,
  })).filter((o) => useful(o.count));
  if (priceOpts.length > 0) groups.push({ id: 'price', title: 'Price', options: [{ value: 'any', label: 'Any price', count: null }, ...priceOpts] });

  // Discount
  const discOpts = DISCOUNT_TIERS.map((t) => ({ value: t, label: `${t}% off or more`, count: deals.filter((d) => dealPct(d) >= t).length })).filter((o) => useful(o.count));
  if (discOpts.length > 0) groups.push({ id: 'discount', title: 'Discount', options: [{ value: null, label: 'Any discount', count: null }, ...discOpts] });

  // Distance (only when we know where the shopper is)
  if (opts.hasLocation) {
    const distOpts = DISTANCE_TIERS.map((t) => ({ value: t, label: `Within ${t} mi`, count: deals.filter((d) => d.distanceMiles != null && d.distanceMiles <= t).length })).filter((o) => useful(o.count));
    if (distOpts.length > 0) groups.push({ id: 'distance', title: 'Distance', options: [{ value: null, label: 'Any distance', count: null }, ...distOpts] });
  }

  // Rating
  const rateOpts = RATING_TIERS.map((t) => ({ value: t, label: `${t}★ & up`, count: deals.filter((d) => (d.vendor.combinedRating ?? 0) >= t).length })).filter((o) => useful(o.count));
  if (rateOpts.length > 0) groups.push({ id: 'rating', title: 'Rating', options: [{ value: null, label: 'Any rating', count: null }, ...rateOpts] });

  return groups;
}

/** Apply the current filter selection to a single deal (client-side). */
export function dealMatchesFilters(d: DealSummary, f: ListingFilters): boolean {
  if (f.subtype != null && d.category.subtypeSlug !== f.subtype) return false;
  if (f.price !== 'any') {
    const bucket = PRICE_BUCKETS.find((b) => b.key === f.price);
    const cents = d.headlineVariant?.dealPriceCents;
    if (!bucket || cents == null || !bucket.test(cents)) return false;
  }
  if (f.discount != null && dealPct(d) < f.discount) return false;
  if (f.distance != null && !(d.distanceMiles != null && d.distanceMiles <= f.distance)) return false;
  if (f.minRating != null && (d.vendor.combinedRating ?? 0) < f.minRating) return false;
  return true;
}

export function activeFilterCount(f: ListingFilters): number {
  return [f.subtype !== null, f.price !== 'any', f.discount !== null, f.distance !== null, f.minRating !== null].filter(Boolean).length;
}

function selectedValue(f: ListingFilters, id: GroupId): string | number | null {
  switch (id) {
    case 'subtype': return f.subtype;
    case 'price': return f.price;
    case 'discount': return f.discount;
    case 'distance': return f.distance;
    case 'rating': return f.minRating;
  }
}

function patchFor(id: GroupId, value: string | number | null): Partial<ListingFilters> {
  switch (id) {
    case 'subtype': return { subtype: value as string | null };
    case 'price': return { price: (value as PriceKey) ?? 'any' };
    case 'discount': return { discount: value as number | null };
    case 'distance': return { distance: value as number | null };
    case 'rating': return { minRating: value as number | null };
  }
}

export function FilterControls({
  groups,
  filters,
  onChange,
}: {
  groups: FilterGroup[];
  filters: ListingFilters;
  onChange: (next: ListingFilters) => void;
}) {
  const count = activeFilterCount(filters);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h3 style={{ fontSize: 17 }}>Filters</h3>
        {count > 0 ? <button type="button" className="see-all" onClick={() => onChange(DEFAULT_FILTERS)}>Clear all</button> : null}
      </div>

      {groups.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', paddingTop: 12 }}>No filters needed — every deal here is a match.</p>
      ) : (
        groups.map((g) => {
          const sel = selectedValue(filters, g.id);
          return (
            <div key={g.id} className="filter-group">
              <h4>{g.title}</h4>
              {g.options.map((o) => {
                const active = sel === o.value;
                return (
                  <button key={String(o.value)} type="button" className="filter-opt" data-active={active} onClick={() => onChange({ ...filters, ...patchFor(g.id, o.value) })}>
                    <span className="filter-dot"><i /></span>
                    <span style={{ flex: 1 }}>{o.label}</span>
                    {o.count != null ? <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{o.count}</span> : null}
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
