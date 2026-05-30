'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

/**
 * God-mode waitlist view. People who opened the app outside the launch area and
 * asked to be notified. The city rollup IS the expansion roadmap — sign vendors
 * where demand is highest, and the consumer "coming soon" gate opens itself the
 * moment that city gets its first live deal.
 */
export function WaitlistView() {
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const totals = trpc.waitlist.adminTotals.useQuery();
  const byCity = trpc.waitlist.adminByCity.useQuery();
  const entries = trpc.waitlist.adminEntries.useQuery(
    cityFilter ? { city: cityFilter } : undefined,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Waitlist</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          People outside the launch area who want in. Demand by city = where to expand next.
        </p>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
        <Stat label="Total signups" value={totals.data ? String(totals.data.total) : '—'} hero />
        <Stat label="Cities represented" value={totals.data ? String(totals.data.cities) : '—'} />
      </div>

      {/* City rollup — the expansion roadmap */}
      <div>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Demand by city</h2>
        <div style={tableShell}>
          {byCity.isLoading ? (
            <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : !byCity.data || byCity.data.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No signups yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                  <Th>City</Th>
                  <Th align="right">Waiting</Th>
                  <Th>Latest signup</Th>
                  <Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {byCity.data.map((c) => {
                  const label = c.cityLabel ?? '(unknown)';
                  const isActive = cityFilter === c.cityLabel;
                  return (
                    <tr
                      key={label}
                      style={{ borderTop: '1px solid var(--border-subtle)', background: isActive ? 'var(--brand-50)' : 'transparent' }}
                    >
                      <Td><strong>{label}</strong></Td>
                      <Td align="right" mono>{c.count}</Td>
                      <Td>{new Date(c.latestAt).toLocaleDateString()}</Td>
                      <Td align="right">
                        <button
                          onClick={() => setCityFilter(isActive ? null : c.cityLabel)}
                          style={linkBtn}
                        >
                          {isActive ? 'Clear' : 'View people'}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Raw signups */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16 }}>
            Signups{cityFilter ? ` · ${cityFilter}` : ''}
          </h2>
          {cityFilter ? (
            <button onClick={() => setCityFilter(null)} style={linkBtn}>Show all</button>
          ) : null}
        </div>
        <div style={tableShell}>
          {entries.isLoading ? (
            <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : !entries.data || entries.data.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No signups{cityFilter ? ' in this city' : ''} yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                  <Th>Email</Th>
                  <Th>City</Th>
                  <Th>Coords</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {entries.data.map((e) => (
                  <tr key={e.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <Td><strong>{e.email}</strong></Td>
                    <Td style={{ color: 'var(--text-secondary)' }}>{e.cityLabel ?? '—'}</Td>
                    <Td mono style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {e.lat != null && e.lng != null ? `${e.lat.toFixed(3)}, ${e.lng.toFixed(3)}` : '—'}
                    </Td>
                    <Td>{new Date(e.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div style={{ padding: 14, background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: hero ? 28 : 20, fontWeight: 700, marginTop: 2, color: hero ? 'var(--brand-600)' : 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <th style={{ textAlign: align ?? 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12 }}>{children}</th>;
}

function Td({ children, align, mono, style }: { children: React.ReactNode; align?: 'right'; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{ textAlign: align ?? 'left', padding: '10px 14px', fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined, ...style }}>
      {children}
    </td>
  );
}

const tableShell: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  background: 'var(--surface-elevated)',
};

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--brand-600)',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};
