'use client';

import { trpc } from '../../../lib/trpc';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function moneyDetail(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Pulse: the founder-grade "what's happening RIGHT NOW" view. Polls every 10s. */
export function PulseView({ onNavigate }: { onNavigate: (view: 'transactions' | 'vendors' | 'payouts' | 'fees' | 'settings') => void }) {
  const pulse = trpc.admin.pulse.useQuery(undefined, { refetchInterval: 10_000 });
  const recent = trpc.admin.recentActivity.useQuery(undefined, { refetchInterval: 15_000 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Pulse</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Right now. Refreshes every 10s.
        </p>
      </div>

      {/* Hero — today's revenue */}
      <Card>
        <Eyebrow>Today</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, marginTop: 8 }}>
          <BigStat hero
            value={pulse.data ? moneyDetail(pulse.data.fee_today_cents) : '…'}
            label="Gloē income today"
            sub={pulse.data ? `from ${moneyDetail(pulse.data.paid_today_cents)} gross · ${pulse.data.paid_today_count} sales` : undefined}
          />
          <BigStat
            value={pulse.data ? String(pulse.data.redemptions_today) : '…'}
            label="Redemptions"
          />
          <BigStat
            value={pulse.data ? moneyDetail(pulse.data.in_flight_cents) : '…'}
            label="In flight"
            sub={pulse.data ? `${pulse.data.in_flight_count} waiting to release` : undefined}
            onClick={() => onNavigate('transactions')}
          />
        </div>
      </Card>

      {/* Needs attention */}
      <Card>
        <Eyebrow>Needs attention</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          <Need
            count={pulse.data?.failed_payouts ?? 0}
            label="Failed payouts"
            tone="error"
            onClick={() => onNavigate('payouts')}
            empty="No failed payouts."
          />
          <Need
            count={pulse.data?.pending_deals ?? 0}
            label="Deals waiting for review"
            tone="brand"
            onClick={() => onNavigate('settings')}
            empty="No deals waiting."
          />
          <Need
            count={pulse.data?.vendors_blocked ?? 0}
            label={`Vendors not Stripe-active (of ${pulse.data?.vendors_total ?? '…'})`}
            tone="neutral"
            onClick={() => onNavigate('vendors')}
            empty="All vendors are Stripe-active."
            last
          />
        </div>
      </Card>

      {/* Recent activity */}
      <Card>
        <Eyebrow>Recent activity</Eyebrow>
        {!recent.data || recent.data.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '12px 0' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
            {recent.data.slice(0, 8).map((row, i) => (
              <div key={row.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i === Math.min(7, recent.data!.length - 1) ? 'none' : '1px solid var(--border-subtle)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {row.buyer ?? 'Customer'} bought from {row.businessName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {row.paidAt ? new Date(row.paidAt).toLocaleString() : 'pending'}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {money(row.consumerPaidCents)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 60, textAlign: 'right' }}>
                  fee {money(row.platformFeeCents)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 18,
    }}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-tertiary)',
    }}>
      {children}
    </div>
  );
}

function BigStat({
  value, label, sub, hero, onClick,
}: {
  value: string;
  label: string;
  sub?: string;
  hero?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: 'left',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{
        fontSize: hero ? 36 : 24,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: hero ? 'var(--brand-600)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontStyle: 'italic' }}>{sub}</div> : null}
    </button>
  );
}

function Need({
  count, label, tone, onClick, empty, last,
}: {
  count: number;
  label: string;
  tone: 'error' | 'brand' | 'neutral';
  onClick: () => void;
  empty: string;
  last?: boolean;
}) {
  const color = tone === 'error' ? 'var(--error)' : tone === 'brand' ? 'var(--brand-600)' : 'var(--text-tertiary)';
  const ok = count === 0;
  return (
    <button
      onClick={ok ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        background: 'none',
        border: 'none',
        cursor: ok ? 'default' : 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{
        minWidth: 36,
        height: 28,
        borderRadius: 999,
        padding: '0 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: ok ? 'var(--surface-secondary)' : color,
        color: ok ? 'var(--text-tertiary)' : '#fff',
        fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      }}>
        {count}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: ok ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {ok ? empty : label}
        </div>
      </div>
      {ok ? null : <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>→</span>}
    </button>
  );
}
