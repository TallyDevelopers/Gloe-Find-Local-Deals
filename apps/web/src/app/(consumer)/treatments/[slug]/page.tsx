'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CategoryPills } from '../../../../components/consumer/CategoryPills';
import { DealCard } from '../../../../components/consumer/DealCard';
import {
  DEFAULT_FILTERS,
  FilterControls,
  activeFilterCount,
  buildFilterGroups,
  dealMatchesFilters,
  type ListingFilters,
} from '../../../../components/consumer/ListingFilters';
import { DealGridSkeleton } from '../../../../components/consumer/Skeletons';
import { discountPct } from '../../../../components/consumer/format';
import { useDealLocationArgs, useLocation } from '../../../../lib/location';
import { trpc } from '../../../../lib/trpc';

type Sort = 'recommended' | 'price' | 'discount' | 'rating';

/**
 * Treatment (category) listing — a real route so Back works. Desktop: a sticky,
 * DATA-DRIVEN filter rail (options derived from real inventory) + sorted grid.
 * Mobile: the rail collapses into a slide-up drawer (app vibes).
 */
export default function TreatmentPage() {
  const slug = useParams<{ slug: string }>().slug;
  const router = useRouter();
  const { location } = useLocation();
  const locArgs = useDealLocationArgs();

  const [filters, setFilters] = useState<ListingFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<Sort>('recommended');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const categories = trpc.categories.list.useQuery();
  const category = categories.data?.find((c) => c.slug === slug);
  const subtypes = category?.subtypes ?? [];
  const displayName = category?.displayName ?? 'Treatments';

  // Base set for the category (no server-side facet filters — we derive the
  // filter options + counts from this and filter client-side, so options only
  // appear when they have real inventory).
  const deals = trpc.deals.list.useQuery({ ...locArgs, category: slug, limit: 100 });
  const base = deals.data?.deals ?? [];

  const groups = useMemo(
    () => buildFilterGroups(base, { hasLocation: !!location, subtypes }),
    [base, location, subtypes],
  );

  const results = useMemo(() => {
    const list = base.filter((d) => dealMatchesFilters(d, filters));
    const pct = (d: (typeof list)[number]) => (d.headlineVariant ? discountPct(d.headlineVariant.originalPriceCents, d.headlineVariant.dealPriceCents) : 0);
    if (sort === 'price') list.sort((a, b) => (a.headlineVariant?.dealPriceCents ?? Infinity) - (b.headlineVariant?.dealPriceCents ?? Infinity));
    else if (sort === 'discount') list.sort((a, b) => pct(b) - pct(a));
    else if (sort === 'rating') list.sort((a, b) => (b.vendor.combinedRating ?? 0) - (a.vendor.combinedRating ?? 0));
    return list;
  }, [base, filters, sort]);

  const count = activeFilterCount(filters);
  const controls = <FilterControls groups={groups} filters={filters} onChange={setFilters} />;
  const hasFilters = groups.length > 0;

  return (
    <div>
      {/* Header band */}
      <div style={{ background: 'linear-gradient(180deg, var(--brand-50), var(--surface-primary))', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="consumer-container" style={{ paddingTop: 20, paddingBottom: 24 }}>
          <Link href="/" className="see-all" style={{ display: 'inline-block', marginBottom: 10 }}>← All treatments</Link>
          <h1 style={{ fontSize: 40, lineHeight: 1.05 }}>{displayName}</h1>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 560 }}>
            Up to 60% off {displayName.toLowerCase()} at premium, vetted spas near you — claimed in seconds.
          </p>
          <div style={{ marginTop: 18 }}>
            <CategoryPills selected={slug} onSelect={(s) => router.push(s ? `/treatments/${s}` : '/')} />
          </div>
        </div>
      </div>

      <div className="consumer-container" style={{ paddingTop: 22 }}>
        <div className="listing-layout">
          {/* Desktop filter rail — only when there's something to filter */}
          {hasFilters ? <aside className="filter-rail filter-rail-desktop">{controls}</aside> : <div className="filter-rail-desktop" />}

          {/* Results */}
          <div>
            <div className="listing-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {hasFilters ? (
                  <button type="button" className="filters-btn" onClick={() => setDrawerOpen(true)}>
                    Filters{count > 0 ? ` · ${count}` : ''}
                  </button>
                ) : null}
                <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                  {deals.isLoading ? 'Finding deals…' : `${results.length} deal${results.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>Sort</span>
                <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="recommended">Recommended</option>
                  <option value="price">Lowest price</option>
                  <option value="discount">Biggest discount</option>
                  <option value="rating">Top rated</option>
                </select>
              </label>
            </div>

            {deals.isLoading ? (
              <DealGridSkeleton count={9} />
            ) : results.length > 0 ? (
              <div className="deal-grid">
                {results.map((d) => (
                  <DealCard key={d.id} deal={d} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8 }}>No matches</div>
                <p style={{ color: 'var(--text-secondary)' }}>Try loosening your filters{count > 0 ? '' : ' or widening your location'}.</p>
                {count > 0 ? (
                  <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} style={{ marginTop: 14, background: 'transparent', border: 'none', color: 'var(--brand-600)', fontWeight: 600, cursor: 'pointer' }}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen ? (
        <>
          <div className="filter-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="filter-drawer">
            {controls}
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              style={{ width: '100%', marginTop: 18, background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '14px', fontSize: 16, fontWeight: 700 }}
            >
              Show {results.length} result{results.length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
