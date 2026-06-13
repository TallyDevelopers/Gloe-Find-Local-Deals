'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';

type Row = RouterOutputs['admin']['listCustomers'][number];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return min < 1 ? 'now' : `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Customers explorer — a searchable roster. Clicking a row opens the
 * full-page Customer 360 (/admin/customer/[id]) with purchases, vouchers,
 * credits, refunds, freeze, and push — no drawer (GLO-56).
 */
export function CustomersView() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const list = trpc.admin.listCustomers.useQuery({ query: search || undefined });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Customers</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Every person who&apos;s ever paid. Click for the full file — purchases, vouchers, credits, actions.
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
                <Th>ID</Th>
                <Th>Email</Th>
                <Th>Last seen near</Th>
                <Th align="right">Purchases</Th>
                <Th align="right">Lifetime spend</Th>
                <Th>Last purchase</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((c: Row) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || (c.email ?? '—');
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/admin/customer/${c.id}`)}
                    style={{ cursor: 'pointer', borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <Td><strong>{name}</strong></Td>
                    <Td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{c.displayId}</Td>
                    <Td style={{ color: 'var(--text-secondary)' }}>{c.email ?? '—'}</Td>
                    <Td>
                      {c.lastCity ? (
                        <>
                          {c.lastCity}
                          {c.lastLocationAt ? (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}> · {ago(c.lastLocationAt)}</span>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </Td>
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
