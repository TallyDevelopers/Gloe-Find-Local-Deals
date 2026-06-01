'use client';

import { useEffect, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';
import { CopyableId } from '../components/CopyableId';

type Row = RouterOutputs['admin']['listCustomers'][number];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CustomersViewProps {
  /** When set, drawer opens for this customer on mount. Used by cross-tab links. */
  preselectedId?: string | null;
  onPreselectionConsumed?: () => void;
  /** Click a refunded txn's badge → jump to the Refunds tab + flash that record. */
  onJumpToRefundByTxn?: (transactionId: string) => void;
}

export function CustomersView({ preselectedId, onPreselectionConsumed, onJumpToRefundByTxn }: CustomersViewProps = {}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const list = trpc.admin.listCustomers.useQuery({ query: search || undefined });

  // Honor a one-shot cross-tab navigation (e.g. clicking customer name on a
  // transaction row). Clearing the parent's state on consumption keeps the
  // drawer dismissable like any other.
  useEffect(() => {
    if (preselectedId) {
      setSelected(preselectedId);
      onPreselectionConsumed?.();
    }
  }, [preselectedId, onPreselectionConsumed]);

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
                <Th>ID</Th>
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
                    <Td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{c.displayId}</Td>
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

      {selected ? <CustomerDrawer id={selected} onClose={() => setSelected(null)} onJumpToRefundByTxn={onJumpToRefundByTxn} /> : null}
    </div>
  );
}

function CustomerDrawer({ id, onClose, onJumpToRefundByTxn }: { id: string; onClose: () => void; onJumpToRefundByTxn?: (transactionId: string) => void }) {
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
              <div style={{ marginTop: 8 }}>
                <CopyableId id={d.customer.displayId} label="Customer" />
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
                    <TransactionRow key={t.id} t={t} onRefunded={() => q.refetch()} onJumpToRefundByTxn={onJumpToRefundByTxn} />
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
function DuplicateChargeAlerts({ transactions }: { transactions: CustomerTxn[] }) {
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
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}>
                <span>{new Date(t.paidAt ?? t.createdAt).toLocaleTimeString()}</span>
                <span style={{ color: 'var(--brand-600)', fontWeight: 700 }}>{money(t.consumerPaidCents)}</span>
                <CopyableId id={t.displayId} label="Txn" />
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

type CustomerTxn = NonNullable<RouterOutputs['admin']['customerDetail']>['transactions'][number];

/**
 * One row in the customer drawer's transaction list. Renders a Refund button
 * iff the txn is eligible (not yet fully refunded AND the voucher hasn't been
 * redeemed). Eligibility-checking here is a UX shortcut — the server is still
 * the source of truth and will reject ineligible attempts.
 */
function TransactionRow({ t, onRefunded, onJumpToRefundByTxn }: { t: CustomerTxn; onRefunded: () => void; onJumpToRefundByTxn?: (transactionId: string) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const remaining = t.consumerPaidCents - t.refundedCents;
  const isVoucherRedeemed = t.claimStatus === 'redeemed';
  const canRefund = remaining > 0 && !isVoucherRedeemed && (t.status === 'paid' || t.status === 'partially_refunded');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.dealTitle ?? t.vendorName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {t.vendorName} · {t.paidAt ? new Date(t.paidAt).toLocaleString() : 'pending'} · {t.status}
            {t.claimStatus ? <span> · voucher {t.claimStatus}</span> : null}
            {t.refundedCents > 0 ? (
              onJumpToRefundByTxn ? (
                <button
                  onClick={() => onJumpToRefundByTxn(t.id)}
                  title="View refund record"
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                >
                  {' · refunded '}{money(t.refundedCents)} ↗
                </button>
              ) : (
                <span> · refunded {money(t.refundedCents)}</span>
              )
            ) : null}
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(t.consumerPaidCents)}</div>
        {canRefund ? (
          <button
            onClick={() => setModalOpen(true)}
            style={{
              fontSize: 11, fontWeight: 600,
              padding: '5px 10px',
              border: '1px solid var(--border-default)',
              borderRadius: 999,
              background: 'var(--surface-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Refund
          </button>
        ) : null}
      </div>
      {modalOpen ? (
        <RefundModal
          transactionId={t.id}
          maxRefundableCents={remaining}
          alreadyRefundedCents={t.refundedCents}
          dealTitle={t.dealTitle ?? t.vendorName}
          onClose={() => setModalOpen(false)}
          onDone={() => { setModalOpen(false); onRefunded(); }}
        />
      ) : null}
    </>
  );
}

function RefundModal({
  transactionId,
  maxRefundableCents,
  alreadyRefundedCents,
  dealTitle,
  onClose,
  onDone,
}: {
  transactionId: string;
  maxRefundableCents: number;
  alreadyRefundedCents: number;
  dealTitle: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amountInput, setAmountInput] = useState((maxRefundableCents / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refund = trpc.admin.refundTransaction.useMutation();

  const amountCents = Math.round(parseFloat(amountInput || '0') * 100);
  const isValid =
    Number.isFinite(amountCents) &&
    amountCents > 0 &&
    amountCents <= maxRefundableCents &&
    reason.trim().length >= 3;
  const isFull = amountCents === maxRefundableCents;

  const submit = async () => {
    setError(null);
    try {
      await refund.mutateAsync({ transactionId, amountCents, reason: reason.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed.');
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 92vw)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 22,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div>
          <h2 style={{ fontSize: 19, marginBottom: 2 }}>Refund transaction</h2>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{dealTitle}</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Refundable balance: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(maxRefundableCents)}</strong>
          {alreadyRefundedCents > 0 ? <span> · already refunded {money(alreadyRefundedCents)}</span> : null}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Amount (USD)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={(maxRefundableCents / 100).toFixed(2)}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', fontSize: 16, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default)' }}
            />
            <button
              type="button"
              onClick={() => setAmountInput((maxRefundableCents / 100).toFixed(2))}
              style={{ fontSize: 11, padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 999, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Max
            </button>
          </div>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Reason (required, ≥3 chars)</span>
          <input
            type="text"
            placeholder="e.g. customer asked, spa closed, duplicate charge"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={280}
            style={{ padding: '8px 10px', fontSize: 14, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default)' }}
          />
        </label>

        {error ? (
          <div style={{ fontSize: 12, color: 'var(--error)', padding: '8px 10px', background: 'rgba(218,79,71,0.08)', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        ) : null}

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          {isFull
            ? 'Full refund — voucher will be cancelled and the customer is charged back. Gloe keeps the platform fee.'
            : 'Partial refund — voucher stays active so the customer can redeem the kept portion. Gloe keeps the platform fee.'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={refund.isPending}
            style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--border-subtle)', background: 'transparent', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isValid || refund.isPending}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: '1px solid var(--brand-500)', background: isValid ? 'var(--brand-500)' : 'var(--surface-secondary)', color: isValid ? '#fff' : 'var(--text-tertiary)', borderRadius: 'var(--radius-md)', cursor: isValid ? 'pointer' : 'not-allowed' }}
          >
            {refund.isPending ? 'Refunding…' : isFull ? `Refund ${money(amountCents)}` : `Refund ${money(amountCents)} (partial)`}
          </button>
        </div>
      </div>
    </div>
  );
}
