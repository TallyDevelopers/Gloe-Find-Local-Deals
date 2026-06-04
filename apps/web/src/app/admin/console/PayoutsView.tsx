'use client';

import { useMemo, useState } from 'react';

import { trpc } from '../../../lib/trpc';

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--text-tertiary)',
  in_transit: 'var(--brand-500)',
  paid: 'var(--success)',
  failed: 'var(--error)',
  cancelled: 'var(--text-tertiary)',
};

const FILTERS: { key: string; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'failed',     label: 'Failed' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'paid',       label: 'Paid' },
  { key: 'pending',    label: 'Pending' },
];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Translate Stripe's terse failure codes into a plain-English explanation
 * + the action a vendor needs to take. When unknown, fall back to the raw
 * message so we don't hide info.
 */
function translateFailure(message: string | null | undefined): { headline: string; action: string } {
  const m = (message ?? '').toLowerCase();
  if (m.includes('account_closed')) return {
    headline: 'Their bank account was closed.',
    action: 'They need to add a new bank account in their Stripe dashboard.',
  };
  if (m.includes('invalid_account_number') || m.includes('no_account')) return {
    headline: 'Account number doesn\'t match a real account.',
    action: 'They need to re-enter their bank routing + account number in Stripe.',
  };
  if (m.includes('debit_not_authorized')) return {
    headline: 'Their bank rejected the ACH debit.',
    action: 'They need to authorize ACH debits with their bank, or use a different account.',
  };
  if (m.includes('insufficient_funds')) return {
    headline: 'Insufficient funds on the platform side (unusual).',
    action: 'Investigate platform balance — this is on us, not the vendor.',
  };
  if (m.includes('could_not_process')) return {
    headline: 'Bank couldn\'t process the payout (often a temporary issue).',
    action: 'Retry the payout. If it fails again, ask vendor to call their bank.',
  };
  if (!message) return { headline: 'Stripe didn\'t say why.', action: 'Check the Stripe dashboard for this payout.' };
  return { headline: message, action: 'Look up this failure code in Stripe docs for the right action.' };
}

export function PayoutsView() {
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const statuses = useMemo(() => (filter === 'all' ? undefined : [filter]), [filter]);
  const list = trpc.admin.listPayouts.useQuery({ status: statuses, limit: 200 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Payouts</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Money landing in vendors' banks. Failed ones float to the top — click for diagnosis.
        </p>
      </div>

      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: filter === f.key ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
                background: filter === f.key ? 'var(--brand-500)' : 'var(--surface-elevated)',
                color: filter === f.key ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={tableShell}>
        {list.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !list.data || list.data.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No payouts yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {list.data.map((p) => {
              const isFailed = p.status === 'failed';
              const isExpanded = expanded === p.id;
              return (
                <div key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div
                    onClick={() => isFailed && setExpanded(isExpanded ? null : p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 14px',
                      cursor: isFailed ? 'pointer' : 'default',
                      background: isExpanded ? 'var(--brand-50)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a
                        href={`/admin/vendor/${p.vendorId}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-600)', textDecoration: 'none' }}
                      >
                        {p.vendorName} →
                      </a>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {new Date(p.createdAt).toLocaleString()} · <span style={{ fontFamily: 'monospace' }}>{p.stripePayoutId}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
                      {money(p.amountCents)}
                    </div>
                    <div style={{ minWidth: 110, textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[p.status] ?? 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>
                    {isFailed ? <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>{isExpanded ? '▾' : '▸'}</span> : null}
                  </div>
                  {isFailed && isExpanded ? (
                    <FailureInvestigator
                      payoutId={p.id}
                      vendorId={p.vendorId}
                      vendorName={p.vendorName}
                      failureMessage={p.failureMessage}
                      amountCents={p.amountCents}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FailureInvestigator({
  payoutId, vendorId, vendorName, failureMessage, amountCents,
}: {
  payoutId: string;
  vendorId: string;
  vendorName: string;
  failureMessage: string | null;
  amountCents: number;
}) {
  const utils = trpc.useUtils();
  const req = trpc.admin.vendorStripeRequirements.useQuery({ vendorId });
  const retry = trpc.admin.retryPayout.useMutation({
    onSuccess: () => utils.admin.listPayouts.invalidate(),
  });

  const translated = translateFailure(failureMessage);

  return (
    <div style={{
      padding: '14px 18px 18px',
      background: 'var(--surface-secondary)',
      borderTop: '1px dashed var(--border-default)',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={eyebrow}>What happened</div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginTop: 4 }}>
          {translated.headline}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          → {translated.action}
        </div>
        {failureMessage ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 6 }}>
            raw: {failureMessage}
          </div>
        ) : null}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={eyebrow}>Stripe says about this vendor's account</div>
        {req.isLoading ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Loading from Stripe…</div>
        ) : !req.data ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Could not reach Stripe.</div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 13 }}>
            <Pill ok={req.data.payoutsEnabled} label={req.data.payoutsEnabled ? 'payouts enabled' : 'payouts blocked'} />
            <Pill ok={req.data.chargesEnabled} label={req.data.chargesEnabled ? 'charges enabled' : 'charges blocked'} />
            {req.data.disabledReason ? <Pill ok={false} label={`disabled: ${req.data.disabledReason}`} /> : null}
            {req.data.pastDue.length > 0 ? <Pill ok={false} label={`past due: ${req.data.pastDue.join(', ')}`} /> : null}
            {req.data.currentlyDue.length > 0 ? <Pill ok={null} label={`currently due: ${req.data.currentlyDue.join(', ')}`} /> : null}
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
              External accounts on file: {req.data.externalAccounts.length === 0 ? 'none' : req.data.externalAccounts.map((e) => `${e.type} •••• ${e.last4 ?? '????'}`).join(', ')}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => retry.mutate({ payoutId })}
          disabled={retry.isPending}
          style={primaryBtn}
        >
          {retry.isPending ? 'Retrying…' : `Retry payout (${money(amountCents)})`}
        </button>
        <a
          href={`mailto:?subject=Action%20needed%20on%20your%20Stripe%20account&body=Hey%20${encodeURIComponent(vendorName)}%2C%0A%0AYour%20last%20payout%20couldn't%20reach%20your%20bank.%20${encodeURIComponent(translated.headline)}%20${encodeURIComponent(translated.action)}%0A%0AOpen%20your%20Stripe%20dashboard%20to%20fix%20it.%20Reply%20to%20this%20email%20when%20you've%20updated%20it%20and%20I'll%20retry.%0A%0AThanks%2C%0ARyan`}
          style={secondaryLink}
        >
          Email vendor
        </a>
      </div>
      {retry.error ? (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>{retry.error.message}</div>
      ) : null}
      {retry.data ? (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
          New payout created: {retry.data.newPayoutId}
        </div>
      ) : null}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean | null; label: string }) {
  const c = ok === null ? 'var(--accent-500)' : ok ? 'var(--success)' : 'var(--error)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      color: '#fff', background: c,
      marginRight: 6, marginBottom: 4,
    }}>{label}</span>
  );
}

const tableShell: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};
const toolbar: React.CSSProperties = {
  display: 'flex', gap: 10, padding: 10,
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-tertiary)',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: 'white',
};
const secondaryLink: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600,
  border: '1px solid var(--border-default)', borderRadius: 999,
  background: 'var(--surface-elevated)', color: 'var(--text-primary)',
  textDecoration: 'none', display: 'inline-block',
};
