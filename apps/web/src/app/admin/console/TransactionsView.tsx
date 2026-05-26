'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';

type Row = RouterOutputs['admin']['listTransactions'][number];

const STATUS_COLOR: Record<string, string> = {
  pending_payment: 'var(--text-tertiary)',
  paid: 'var(--success)',
  released: 'var(--brand-600)',
  refunded: 'var(--accent-500)',
  partially_refunded: 'var(--accent-500)',
  failed: 'var(--error)',
  disputed: 'var(--error)',
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all',                label: 'All' },
  { key: 'paid',               label: 'Paid' },
  { key: 'released',           label: 'Released' },
  { key: 'pending_payment',    label: 'Pending' },
  { key: 'refunded',           label: 'Refunded' },
  { key: 'failed',             label: 'Failed' },
];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface TransactionsViewProps {
  /** Tell the shell to switch to Customers and open this customer's drawer. */
  onJumpToCustomer?: (customerId: string) => void;
}

export function TransactionsView({ onJumpToCustomer }: TransactionsViewProps = {}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const statusList = useMemo(() => (filter === 'all' ? undefined : [filter]), [filter]);

  const list = trpc.admin.listTransactions.useQuery(
    { status: statusList, query: search || undefined, limit: 100 },
    { refetchInterval: 30_000 },
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Transactions</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Every charge, every release. Click any row for details.
        </p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: 10,
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor, customer, or Stripe id…"
          style={{
            flex: 1, minWidth: 220,
            padding: '8px 12px', fontSize: 14,
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-default)',
            color: 'var(--text-primary)',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
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

      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        {list.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !list.data || list.data.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No transactions match.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <Th>Time</Th>
                <Th>Vendor</Th>
                <Th>Customer</Th>
                <Th align="right">Paid</Th>
                <Th align="right">Fee</Th>
                <Th align="right">Payout</Th>
                <Th>Status</Th>
                <Th>Voucher</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  style={{
                    cursor: 'pointer',
                    borderTop: '1px solid var(--border-subtle)',
                    background: selected === r.id ? 'var(--brand-50)' : 'transparent',
                  }}
                >
                  <Td>{r.paidAt ? new Date(r.paidAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}</Td>
                  <Td>
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/admin/vendor/${r.vendorId}`); }}
                      style={inlineLinkBtn}
                    >
                      {r.vendorName}
                    </button>
                  </Td>
                  <Td style={{ color: r.customerName ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {r.customerId && onJumpToCustomer ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onJumpToCustomer(r.customerId!); }}
                        style={inlineLinkBtn}
                      >
                        {r.customerName ?? r.customerEmail ?? '—'}
                      </button>
                    ) : (
                      r.customerName ?? r.customerEmail ?? '—'
                    )}
                  </Td>
                  <Td align="right" mono>{money(r.consumerPaidCents)}</Td>
                  <Td align="right" mono>{money(r.platformFeeCents)}</Td>
                  <Td align="right" mono>{money(r.vendorPayoutCents)}</Td>
                  <Td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status] ?? 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {r.claimStatus ?? '—'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <TransactionDrawer id={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

const stripeLink: React.CSSProperties = {
  color: 'var(--brand-600)',
  fontWeight: 600,
  textDecoration: 'none',
  fontFamily: 'monospace',
  fontSize: 12,
};

const inlineLinkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--brand-600)',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(0,0,0,0.15)',
  textUnderlineOffset: 2,
  cursor: 'pointer',
  textAlign: 'left',
};

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      padding: '10px 14px', textAlign: align ?? 'left',
    }}>
      {children}
    </th>
  );
}

function Td({ children, align, mono, style }: { children: React.ReactNode; align?: 'right'; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding: '10px 14px',
      textAlign: align ?? 'left',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </td>
  );
}

function TransactionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = trpc.admin.transactionDetail.useQuery({ id });
  const d = detail.data;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.45)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}
    >
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
          <h2 style={{ fontSize: 20 }}>Transaction</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
        </div>

        {!d ? (
          <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="Money">
              <Row label="Customer paid">{money(d.transaction.consumerPaidCents)}</Row>
              <Row label="Platform fee">{money(d.transaction.platformFeeCents)}</Row>
              <Row label="Vendor payout">{money(d.transaction.vendorPayoutCents)}</Row>
              <Row label="Stripe processing">{money(d.transaction.stripeFeeCents)}</Row>
              <Row label="Status"><span style={{ color: STATUS_COLOR[d.transaction.status], fontWeight: 700, textTransform: 'uppercase', fontSize: 12 }}>{d.transaction.status.replace('_', ' ')}</span></Row>
            </Section>

            <FeeMathPanel
              snapshot={d.transaction.platformFeeSnapshot}
              consumerPaidCents={d.transaction.consumerPaidCents}
              platformFeeCents={d.transaction.platformFeeCents}
              vendorPayoutCents={d.transaction.vendorPayoutCents}
            />

            <Section title="Timestamps">
              <Row label="Created">{new Date(d.transaction.createdAt).toLocaleString()}</Row>
              <Row label="Paid">{d.transaction.paidAt ? new Date(d.transaction.paidAt).toLocaleString() : '—'}</Row>
              <Row label="Released">{d.transaction.releasedAt ? new Date(d.transaction.releasedAt).toLocaleString() : '—'}</Row>
              <Row label="Refunded">{d.transaction.refundedAt ? new Date(d.transaction.refundedAt).toLocaleString() : '—'}</Row>
            </Section>

            <Section title="Parties">
              <Row label="Vendor">
                <a href={`/admin/vendor/${d.vendor.id}`} style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{d.vendor.name} →</a>
              </Row>
              <Row label="Customer">{d.customer ? `${d.customer.name ?? '—'}` : '—'}</Row>
              <Row label="Customer email">{d.customer?.email ?? '—'}</Row>
            </Section>

            <Section title="Stripe references">
              <Row label="PaymentIntent" mono>
                {d.transaction.stripePaymentIntentId ? (
                  <a href={`https://dashboard.stripe.com/test/payments/${d.transaction.stripePaymentIntentId}`} target="_blank" rel="noreferrer" style={stripeLink}>
                    {d.transaction.stripePaymentIntentId} ↗
                  </a>
                ) : '—'}
              </Row>
              <Row label="Charge" mono>
                {d.transaction.stripeChargeId ? (
                  <a href={`https://dashboard.stripe.com/test/payments/${d.transaction.stripeChargeId}`} target="_blank" rel="noreferrer" style={stripeLink}>
                    {d.transaction.stripeChargeId} ↗
                  </a>
                ) : '—'}
              </Row>
              <Row label="Transfer" mono>
                {d.transaction.stripeTransferId ? (
                  <a href={`https://dashboard.stripe.com/test/connect/transfers/${d.transaction.stripeTransferId}`} target="_blank" rel="noreferrer" style={stripeLink}>
                    {d.transaction.stripeTransferId} ↗
                  </a>
                ) : '—'}
              </Row>
            </Section>

            {d.claims.length > 0 ? (
              <Section title={`Vouchers (${d.claims.length})`}>
                {d.claims.map((c) => (
                  <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {c.humanCode} · <span style={{ color: STATUS_COLOR[c.status] ?? 'var(--text-tertiary)' }}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {c.redeemedAt ? `redeemed ${new Date(c.redeemedAt).toLocaleString()}` : `expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </Section>
            ) : null}

            {d.audit.length > 0 ? (
              <Section title="Audit trail">
                {d.audit.map((a) => (
                  <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>{a.action}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </Section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Renders the platform-fee math from the snapshot stored on the transaction.
 * This is the "explain why we took $X" panel — answers the most common
 * vendor question without any guesswork on our end.
 */
function FeeMathPanel({
  snapshot,
  consumerPaidCents,
  platformFeeCents,
  vendorPayoutCents,
}: {
  snapshot: Record<string, unknown> | null;
  consumerPaidCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
}) {
  if (!snapshot) {
    return (
      <Section title="Fee math">
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '6px 0' }}>
          No fee snapshot — this transaction was created before snapshots were captured. Math: {money(consumerPaidCents)} − {money(platformFeeCents)} fee = {money(vendorPayoutCents)} to vendor.
        </div>
      </Section>
    );
  }
  const label = String(snapshot.label ?? '—');
  const percentBps = Number(snapshot.percentBps ?? 0);
  const flatCents = Number(snapshot.flatCents ?? 0);
  const minFeeCents = Number(snapshot.minFeeCents ?? 0);
  const isFlat = flatCents > 0;
  const human = isFlat
    ? `flat ${money(flatCents)}`
    : `${(percentBps / 100).toFixed(percentBps % 100 === 0 ? 0 : 2)}%`;
  const explainLine = isFlat
    ? `Tier "${label}" charges a flat ${money(flatCents)} for any price in its range. Customer paid ${money(consumerPaidCents)} → fee ${money(platformFeeCents)} → vendor receives ${money(vendorPayoutCents)}.`
    : `Tier "${label}" charges ${human}. ${money(consumerPaidCents)} × ${(percentBps/100).toFixed(2)}% = ${money(Math.round(consumerPaidCents * percentBps / 10000))}${minFeeCents > 0 ? ` (floored at ${money(minFeeCents)})` : ''}. Vendor receives ${money(vendorPayoutCents)}.`;
  return (
    <Section title="Fee math (snapshot)">
      <Row label="Tier name">{label}</Row>
      <Row label="Rule">{human}</Row>
      {minFeeCents > 0 ? <Row label="Minimum fee">{money(minFeeCents)}</Row> : null}
      <div style={{ padding: '10px 0 4px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {explainLine}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '4px 0 6px' }}>
        Snapshot was frozen at purchase. Editing the tier today does not change this booking.
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{title}</div>
      <div style={{ background: 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '4px 12px' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{
        color: 'var(--text-primary)', fontWeight: 600,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all', textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {children}
      </span>
    </div>
  );
}
