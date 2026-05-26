'use client';

import { trpc } from '../../../lib/trpc';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function moneyDetail(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Nav = 'transactions' | 'vendors' | 'payouts' | 'fees' | 'settings' | 'customers' | 'audit';

/**
 * Pulse — the founder operating dashboard. Single screen that answers:
 * "Where do I stand? What needs my attention? How's the business trending?"
 *
 * Four sections:
 *   1. Money state (Stripe balance, what we owe, true net position)
 *   2. Performance (today / week / month rollups + deltas)
 *   3. Vendor health (active, holding money, churn risk, blocked)
 *   4. Alerts (vouchers expiring, recent refunds, audit warnings)
 *
 * Polls every 10s for the DB stuff. Stripe live balance refreshes every 30s
 * because it's a network call to Stripe — not worth hammering.
 */
export function PulseView({ onNavigate }: { onNavigate: (view: Nav) => void }) {
  const pulse = trpc.admin.pulse.useQuery(undefined, { refetchInterval: 10_000 });
  const stripeBal = trpc.admin.platformStripeBalance.useQuery(undefined, { refetchInterval: 30_000 });
  const recent = trpc.admin.recentActivity.useQuery(undefined, { refetchInterval: 15_000 });
  const p = pulse.data;
  const sb = stripeBal.data;

  // The "true net" Gloe owns right now: liquid Stripe balance minus what we owe vendors.
  // (Pending Stripe balance isn't liquid yet but is on the way.)
  const stripeAvailable = sb?.availableCents ?? 0;
  const stripePending = sb?.pendingCents ?? 0;
  const owedToVendors = (p?.owed_active_cents ?? 0) + (p?.owed_redeemed_cents ?? 0);
  const trueNetCents = stripeAvailable + stripePending - owedToVendors;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Pulse</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
            The founder dashboard. Refreshes every 10s.
          </p>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {pulse.isFetching ? '⟳ syncing…' : `✓ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        </div>
      </div>

      {/* ═══════ SECTION 1 — MONEY STATE ═══════ */}
      <Section title="Money state" sub="Where the cash sits right now.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <BigStat
            hero
            value={moneyDetail(stripeAvailable + stripePending)}
            label="Total in Stripe (gross)"
            sub={`${moneyDetail(stripeAvailable)} available · ${moneyDetail(stripePending)} pending`}
          />
          <BigStat
            value={moneyDetail(owedToVendors)}
            label="Owed to vendors"
            sub={`${moneyDetail(p?.owed_active_cents ?? 0)} held · ${moneyDetail(p?.owed_redeemed_cents ?? 0)} due now`}
            tone={p && p.owed_redeemed_cents > 0 ? 'warn' : 'neutral'}
          />
          <BigStat
            value={moneyDetail(trueNetCents)}
            label="True net to Gloe"
            sub="Stripe balance − vendor liability"
            tone="brand"
          />
        </div>
        {sb && 'error' in sb && sb.error ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
            ⚠ Stripe live balance unavailable — showing $0 in those cells. {sb.error}
          </div>
        ) : null}
      </Section>

      {/* ═══════ SECTION 2 — PERFORMANCE ═══════ */}
      <Section title="Performance" sub="Gross sales · Gloe fee · refunds, by period.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <PeriodColumn
            label="Today"
            gross={p?.paid_today_cents ?? 0}
            fee={p?.fee_today_cents ?? 0}
            refunded={p?.refunded_today_cents ?? 0}
            previousLabel="vs yesterday"
            previousGross={p?.paid_yesterday_cents ?? 0}
          />
          <PeriodColumn
            label="Last 7 days"
            gross={p?.paid_week_cents ?? 0}
            fee={p?.fee_week_cents ?? 0}
            refunded={p?.refunded_week_cents ?? 0}
          />
          <PeriodColumn
            label="This month"
            gross={p?.paid_month_cents ?? 0}
            fee={p?.fee_month_cents ?? 0}
            refunded={p?.refunded_month_cents ?? 0}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
            <Eyebrow>Redemptions today</Eyebrow>
            <div style={{ fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {p?.redemptions_today ?? 0}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {p?.paid_today_count ?? 0} sales today
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════ SECTION 3 — VENDOR HEALTH ═══════ */}
      <Section title="Vendor health" sub="Who's active, who needs you.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <BigStat
            value={`${p?.vendors_active_count ?? '…'} / ${p?.vendors_total ?? '…'}`}
            label="Active Stripe vendors"
            onClick={() => onNavigate('vendors')}
          />
          <BigStat
            value={String(p?.vendors_with_held_money_count ?? '…')}
            label="Holding their money"
            sub="Redeemed but not pushed"
            tone={p && p.vendors_with_held_money_count > 0 ? 'warn' : 'neutral'}
            onClick={() => onNavigate('vendors')}
          />
          <BigStat
            value={String(p?.vendors_blocked ?? '…')}
            label="Not Stripe-active"
            sub="Can't receive payouts"
            tone={p && p.vendors_blocked > 0 ? 'warn' : 'neutral'}
            onClick={() => onNavigate('vendors')}
          />
          <BigStat
            value={String(p?.vendors_stale_30d_count ?? '…')}
            label="No sales 30 days"
            sub="Churn risk"
            tone={p && p.vendors_stale_30d_count > 0 ? 'warn' : 'neutral'}
            onClick={() => onNavigate('vendors')}
          />
        </div>
      </Section>

      {/* ═══════ SECTION 4 — ALERTS ═══════ */}
      <Section title="Needs attention" sub="Items that need a click today.">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Alert
            count={p?.failed_payouts ?? 0}
            label="Failed payouts"
            tone="error"
            onClick={() => onNavigate('payouts')}
            empty="No failed payouts."
          />
          <Alert
            count={p?.in_flight_count ?? 0}
            label={`Redemptions waiting to release (${moneyDetail(p?.in_flight_cents ?? 0)})`}
            tone="brand"
            onClick={() => onNavigate('vendors')}
            empty="Nothing waiting to release."
          />
          <Alert
            count={p?.pending_deals ?? 0}
            label="Deals waiting for review"
            tone="brand"
            onClick={() => onNavigate('settings')}
            empty="No deals waiting for review."
          />
          <Alert
            count={p?.vouchers_expiring_7d ?? 0}
            label="Vouchers expiring in next 7 days"
            tone="neutral"
            onClick={() => onNavigate('transactions')}
            empty="No vouchers expiring soon."
          />
          <Alert
            count={p?.refunds_recent_7d ?? 0}
            label="Refunds issued (last 7 days)"
            tone="neutral"
            onClick={() => onNavigate('transactions')}
            empty="No recent refunds."
          />
          <Alert
            count={p?.audit_warnings_24h ?? 0}
            label="Audit log warnings (last 24h)"
            sub="Refused transfers / refunds / failed payouts"
            tone="neutral"
            onClick={() => onNavigate('audit')}
            empty="No audit warnings."
            last
          />
        </div>
      </Section>

      {/* ═══════ SECTION 5 — RECENT ACTIVITY (kept) ═══════ */}
      <Section title="Recent activity" sub="Newest sales first.">
        {!recent.data || recent.data.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '12px 0' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
      </Section>
    </div>
  );
}

/* ─────────────── components ─────────────── */

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 18,
    }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
        {sub ? <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
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
  value, label, sub, hero, tone, onClick,
}: {
  value: string;
  label: string;
  sub?: string;
  hero?: boolean;
  tone?: 'brand' | 'warn' | 'neutral';
  onClick?: () => void;
}) {
  const color = tone === 'brand' ? 'var(--brand-600)'
    : tone === 'warn' ? 'var(--accent-500)'
    : hero ? 'var(--brand-600)'
    : 'var(--text-primary)';
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: 'left',
        background: 'var(--surface-secondary)',
        border: '1px solid var(--border-subtle)',
        padding: 14,
        borderRadius: 'var(--radius-md)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div style={{
        fontSize: hero ? 30 : 22,
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div> : null}
    </button>
  );
}

function PeriodColumn({
  label, gross, fee, refunded, previousLabel, previousGross,
}: {
  label: string;
  gross: number;
  fee: number;
  refunded: number;
  previousLabel?: string;
  previousGross?: number;
}) {
  // Delta vs previous (e.g. today vs yesterday). Only shown if caller passed it.
  let delta: { label: string; tone: 'up' | 'down' | 'flat' } | null = null;
  if (previousLabel != null && previousGross != null) {
    if (previousGross === 0 && gross === 0) {
      delta = { label: `${previousLabel}: flat`, tone: 'flat' };
    } else if (previousGross === 0) {
      delta = { label: `${previousLabel}: new`, tone: 'up' };
    } else {
      const pct = ((gross - previousGross) / previousGross) * 100;
      const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
      delta = {
        label: `${arrow} ${Math.abs(pct).toFixed(0)}% ${previousLabel}`,
        tone: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
      };
    }
  }
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: 14,
      background: 'var(--surface-secondary)',
      borderRadius: 'var(--radius-md)',
    }}>
      <Eyebrow>{label}</Eyebrow>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {moneyDetail(gross)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>gross</div>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>+{moneyDetail(fee)} fee</span>
        {refunded > 0 ? <span style={{ color: 'var(--accent-500)' }}>−{moneyDetail(refunded)} refunded</span> : null}
      </div>
      {delta ? (
        <div style={{
          fontSize: 11,
          color: delta.tone === 'up' ? 'var(--success)' : delta.tone === 'down' ? 'var(--error)' : 'var(--text-tertiary)',
          fontWeight: 600,
        }}>
          {delta.label}
        </div>
      ) : null}
    </div>
  );
}

function Alert({
  count, label, sub, tone, onClick, empty, last,
}: {
  count: number;
  label: string;
  sub?: string;
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
        {sub && !ok ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div> : null}
      </div>
      {ok ? null : <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>→</span>}
    </button>
  );
}
