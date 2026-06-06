import type { RouterInputs } from '@gloe/api-client';

/** The deals.list input is optional (void | {...}); narrow to the object form. */
type DealsListInput = Extract<RouterInputs['deals']['list'], { sort?: unknown }>;

/** Sort options the map exposes (subset of the API's DealSort that makes sense here). */
export type MapSort = DealsListInput['sort'];

/**
 * Everything the map's chip row can constrain. Maps 1:1 onto `deals.list`
 * inputs, so applying a filter is just spreading this into the query. All
 * optional — undefined/empty means "no constraint."
 */
export interface MapFilters {
  maxDistanceMiles?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  minDiscountPct?: number;
  minRating?: number;
  vibes: string[];
  sort?: MapSort;
}

export const EMPTY_MAP_FILTERS: MapFilters = { vibes: [] };

export const RATING_OPTS: { label: string; value: number | undefined }[] = [
  { label: 'Any rating', value: undefined },
  { label: '3.5+', value: 3.5 },
  { label: '4.0+', value: 4.0 },
  { label: '4.5+', value: 4.5 },
];

export const PRICE_OPTS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any price' },
  { label: 'Under $100', max: 10000 },
  { label: '$100–$300', min: 10000, max: 30000 },
  { label: '$300–$700', min: 30000, max: 70000 },
  { label: '$700+', min: 70000 },
];

export const SORT_OPTS: { label: string; value: MapSort | undefined }[] = [
  { label: 'Best match', value: undefined },
  { label: 'Closest', value: 'distance' },
  { label: 'Top rated', value: 'rating' },
  { label: 'Lowest price', value: 'price' },
  { label: 'Biggest discount', value: 'discount' },
];

/** Count of active (non-default) filter groups — drives the "Filter · 2" badge. */
export function activeFilterCount(f: MapFilters): number {
  return (
    (f.maxDistanceMiles !== undefined ? 1 : 0) +
    (f.minPriceCents !== undefined || f.maxPriceCents !== undefined ? 1 : 0) +
    (f.minDiscountPct !== undefined ? 1 : 0) +
    (f.minRating !== undefined ? 1 : 0) +
    (f.vibes.length > 0 ? 1 : 0) +
    (f.sort !== undefined ? 1 : 0)
  );
}
