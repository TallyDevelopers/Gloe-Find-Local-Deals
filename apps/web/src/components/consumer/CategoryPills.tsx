'use client';

import { trpc } from '../../lib/trpc';

/**
 * Horizontal, scrollable category filter. "All" + each category from
 * categories.list. Controlled via `selected` (slug | null) + `onSelect`.
 */
export function CategoryPills({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const categories = trpc.categories.list.useQuery();

  const items: { slug: string | null; label: string }[] = [
    { slug: null, label: 'All' },
    ...(categories.data ?? []).map((c) => ({ slug: c.slug, label: c.displayName })),
  ];

  return (
    <div className="hide-scrollbar" style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '2px 0' }}>
      {items.map((item) => {
        const active = selected === item.slug;
        return (
          <button
            key={item.slug ?? 'all'}
            type="button"
            onClick={() => onSelect(item.slug)}
            style={{
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 600,
              padding: '9px 16px',
              borderRadius: 'var(--radius-pill)',
              border: active ? '1px solid var(--brand-500)' : '1px solid var(--border-subtle)',
              background: active ? 'var(--brand-500)' : 'var(--surface-elevated)',
              color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
