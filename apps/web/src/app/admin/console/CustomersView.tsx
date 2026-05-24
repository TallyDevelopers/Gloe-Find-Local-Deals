'use client';

import { useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';

type Row = RouterOutputs['admin']['listCustomers'][number];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CustomersView() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const list = trpc.admin.listCustomers.useQuery({ query: search || undefined });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Customers</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Every person who's ever paid. Click for full history.
        </p>
      </div>

      <div style={toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email, or phone…"
          style={searchInput}
        />
      </div>

      <div style={tableShell}>
        {list.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !list.data || list.data.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No customers match.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th align="right">Purchases</Th>
                <Th align="right">Lifetime spend</Th>
                <Th>Last purchase</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || (c.email ?? '—');
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    style={{
                      cursor: 'pointer',
                      borderTop: '1px solid var(--border-subtle)',
                      background: selected === c.id ? 'var(--brand-50)' : 'transparent',
                    }}
                  >
                    <Td><strong>{name}</strong></Td>
                    <Td style={{ color: 'var(--text-secondary)' }}>{c.email ?? '—'}</Td>
                    <Td align="right" mono>{c.purchaseCount}</Td>
                    <Td align="right" mono>{money(c.lifetimePaidCents)}</Td>
                    <Td>{c.lastPaidAt ? new Date(c.lastPaidAt).toLocaleDateString() : '—'}</Td>
                    <Td>{new Date(c.createdAt).toLocaleDateString()}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected ? <CustomerDrawer id={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = trpc.admin.customerDetail.useQuery({ id });
  const d = q.data;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.45)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100vw)',
          height: '100%',
          background: 'var(--surface-elevated)',
          borderLeft: '1px solid var(--border-default)',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 20 }}>Customer</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
        </div>
        {!d ? <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 22, marginBottom: 2 }}>
                {[d.customer.firstName, d.customer.lastName].filter(Boolean).join(' ') || '—'}
              </h3>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                {d.customer.email ?? '—'} · {d.customer.phone ?? '—'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <Stat label="Lifetime spend" value={money(d.totals.lifetime_paid_cents)} hero />
              <Stat label="Purchases"      value={String(d.totals.purchase_count)} />
              <Stat label="Redemptions"    value={String(d.totals.redemption_count)} />
              <Stat label="Refunded"       value={money(d.totals.refunded_cents)} />
            </div>

            <DuplicateChargeAlerts transactions={d.transactions} />

            <div>
              <div style={eyebrow}>Recent transactions</div>
              {d.transactions.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '12px 0' }}>None.</div>
              ) : (
                <div>
                  {d.transactions.slice(0, 20).map((t) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.dealTitle ?? t.vendorName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {t.vendorName} · {t.paidAt ? new Date(t.paidAt).toLocaleString() : 'pending'} · {t.status}
                          {t.claimStatus ? <span> · voucher {t.claimStatus}</span> : null}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(t.consumerPaidCents)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Detect transactions made within a short window of each other — the
 * classic "the customer says I was charged twice" pattern. We surface
 * groups so god mode can tell at a glance whether the duplicate is real.
 */
function DuplicateChargeAlerts({ transactions }: { transactions: Array<{ id: string; consumerPaidCents: number; paidAt: string | null; createdAt: string; vendorName: string }> }) {
  // Look at the last 14 days; flag any 2+ transactions within 5 minutes.
  const WINDOW_MS = 5 * 60 * 1000;
  const recent = transactions.filter((t) => {
    const at = t.paidAt ?? t.createdAt;
    return new Date(at).getTime() > Date.now() - 14 * 24 * 3600 * 1000;
  }).sort((a, b) => {
    const ta = new Date(a.paidAt ?? a.createdAt).getTime();
    const tb = new Date(b.paidAt ?? b.createdAt).getTime();
    return ta - tb;
  });
  const clusters: Array<typeof recent> = [];
  let current: typeof recent = [];
  for (const t of recent) {
    const at = new Date(t.paidAt ?? t.createdAt).getTime();
    const prev = current[current.length - 1];
    if (!prev) { current = [t]; continue; }
    const prevAt = new Date(prev.paidAt ?? prev.createdAt).getTime();
    if (at - prevAt <= WINDOW_MS) {
      current.push(t);
    } else {
      if (current.length >= 2) clusters.push(current);
      current = [t];
    }
  }
  if (current.length >= 2) clusters.push(current);

  if (clusters.length === 0) return null;

  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(178,93,64,0.08)',
      border: '1px solid rgba(178,93,64,0.25)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-500)', marginBottom: 6 }}>
        ⚠ Possible duplicate charges
      </div>
      {clusters.map((cluster, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
          <strong>{cluster.length} charges</strong> within 5 minutes at <strong>{cluster[0]?.vendorName ?? '—'}</strong>:
          <div style={{ marginTop: 4 }}>
            {cluster.map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}>
                <span>{new Date(t.paidAt ?? t.createdAt).toLocaleTimeString()}</span>
                <span style={{ color: 'var(--brand-600)', fontWeight: 700 }}>{money(t.consumerPaidCents)}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{t.id.slice(0, 8)}…</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12 }}>
      <div style={{ fontSize: hero ? 22 : 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: hero ? 'var(--brand-600)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <th style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: align ?? 'left', whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, align, mono, style }: { children: React.ReactNode; align?: 'right'; mono?: boolean; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 14px', textAlign: align ?? 'left', fontVariantNumeric: mono ? 'tabular-nums' : 'normal', whiteSpace: 'nowrap', ...style }}>{children}</td>;
}

const tableShell: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'auto',
};
const toolbar: React.CSSProperties = {
  display: 'flex', gap: 10, padding: 10,
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
const searchInput: React.CSSProperties = {
  flex: 1, padding: '8px 12px', fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};
const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-tertiary)', marginBottom: 6,
};
