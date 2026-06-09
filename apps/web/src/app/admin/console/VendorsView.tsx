'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';

type Row = RouterOutputs['admin']['vendorRoster'][number];
type SortKey = 'name' | 'gross' | 'purchases' | 'deals';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const STRIPE_COLOR: Record<string, string> = {
  active: 'var(--success)',
  pending: 'var(--text-tertiary)',
  restricted: 'var(--accent-500)',
  rejected: 'var(--error)',
  disabled: 'var(--error)',
};

export function VendorsView() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.admin.vendorRoster.useQuery();
  const setOverride = trpc.admin.setVendorOverride.useMutation({
    onSuccess: () => utils.admin.vendorRoster.invalidate(),
  });

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('gross');
  const [filter, setFilter] = useState<'all' | 'unclaimed' | 'no_stripe' | 'active' | 'flagged'>('all');

  const rows = useMemo(() => {
    let r = q.data ?? [];
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter((v) => v.businessName.toLowerCase().includes(s) || v.city.toLowerCase().includes(s));
    }
    if (filter === 'unclaimed') r = r.filter((v) => !v.hasOwner);
    if (filter === 'no_stripe') r = r.filter((v) => v.stripeStatus !== 'active');
    if (filter === 'active')    r = r.filter((v) => v.stripeStatus === 'active');
    if (filter === 'flagged')   r = r.filter((v) => v.isHighDisputeRisk);
    const sorted = [...r].sort((a, b) => {
      switch (sortKey) {
        case 'name':      return a.businessName.localeCompare(b.businessName);
        case 'gross':     return b.grossCents - a.grossCents;
        case 'purchases': return b.purchases - a.purchases;
        case 'deals':     return b.dealCount - a.dealCount;
      }
    });
    return sorted;
  }, [q.data, search, sortKey, filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Vendors</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
            {q.data?.length ?? 0} on the platform.
          </p>
        </div>
        <button onClick={() => router.push('/admin/add-spa')} style={primaryBtn}>+ Add a spa</button>
      </div>

      <div style={toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or city…"
          style={searchInput}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'active', 'no_stripe', 'unclaimed', 'flagged'] as const).map((k) => (
            <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? 'All' : k === 'active' ? 'Stripe active' : k === 'no_stripe' ? 'No Stripe' : k === 'unclaimed' ? 'Unclaimed' : '⚠ Flagged'}
            </Chip>
          ))}
        </div>
      </div>

      <div style={tableShell}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
              <Th sortable onClick={() => setSortKey('name')}      active={sortKey === 'name'}>Vendor</Th>
              <Th>City</Th>
              <Th sortable onClick={() => setSortKey('deals')}     active={sortKey === 'deals'}     align="right">Deals</Th>
              <Th sortable onClick={() => setSortKey('purchases')} active={sortKey === 'purchases'} align="right">Buys</Th>
              <Th align="right">Disputes</Th>
              <Th sortable onClick={() => setSortKey('gross')}     active={sortKey === 'gross'}     align="right">Gross</Th>
              <Th align="right">Gloē income</Th>
              <Th>Stripe</Th>
              <Th>License</Th>
              <Th>Owner</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr><td colSpan={11} style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 20, color: 'var(--text-tertiary)' }}>No vendors match.</td></tr>
            ) : rows.map((v) => (
              <tr
                key={v.id}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--border-subtle)' }}
                onClick={() => router.push(`/admin/vendor/${v.id}`)}
              >
                <Td>
                  <div style={{ fontWeight: 600, color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {v.businessName}
                    {v.isHighDisputeRisk ? (
                      <span title="High dispute rate — over your threshold" style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--error)', padding: '1px 6px', borderRadius: 999 }}>⚠</span>
                    ) : null}
                  </div>
                </Td>
                <Td>{v.city}</Td>
                <Td align="right" mono>{v.dealCount}</Td>
                <Td align="right" mono>{v.purchases}</Td>
                <Td align="right" mono style={{ color: v.isHighDisputeRisk ? 'var(--error)' : v.disputeInWindow > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: v.isHighDisputeRisk ? 800 : 400 }}>
                  {v.disputeInWindow}
                </Td>
                <Td align="right" mono>{money(v.grossCents)}</Td>
                <Td align="right" mono style={{ color: 'var(--brand-600)' }}>{money(v.incomeCents)}</Td>
                <Td>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STRIPE_COLOR[v.stripeStatus ?? 'pending'], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {v.stripeStatus ?? '—'}
                  </span>
                </Td>
                <Td>{v.hasLicense ? <Dot ok /> : <Dot />}</Td>
                <Td>{v.hasOwner ? <Dot ok /> : <Dot />}</Td>
                <Td align="right">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOverride.mutate({ vendorId: v.id, bypassRequirements: true }); }}
                    disabled={setOverride.isPending}
                    title="Open gates — let this vendor post without license/Stripe"
                    style={ghostBtn}
                  >
                    Open gates
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        border: on ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
        background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
        color: on ? 'white' : 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Th({ children, align, sortable, active, onClick }: {
  children: React.ReactNode; align?: 'right'; sortable?: boolean; active?: boolean; onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        padding: '10px 14px',
        textAlign: align ?? 'left',
        cursor: sortable ? 'pointer' : 'default',
        color: active ? 'var(--brand-600)' : 'var(--text-tertiary)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}{sortable && active ? ' ↓' : ''}
    </th>
  );
}

function Td({ children, align, mono, style }: { children: React.ReactNode; align?: 'right'; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding: '12px 14px',
      textAlign: align ?? 'left',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      whiteSpace: 'nowrap',
      ...style,
    }}>{children}</td>
  );
}

function Dot({ ok }: { ok?: boolean }) {
  return <span style={{
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: ok ? 'var(--success)' : 'var(--surface-secondary)',
    border: ok ? 'none' : '1px solid var(--border-default)',
  }} />;
}

const tableShell: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'auto',
};
const toolbar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  padding: 10,
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
const searchInput: React.CSSProperties = {
  flex: 1, minWidth: 220,
  padding: '8px 12px', fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--brand-500)',
  background: 'var(--brand-500)', color: 'white',
};
const ghostBtn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 11, fontWeight: 700,
  borderRadius: 999,
  border: '1px solid var(--brand-500)',
  background: 'var(--surface-elevated)',
  color: 'var(--brand-600)',
};
