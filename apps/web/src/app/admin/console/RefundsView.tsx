'use client';

import type { RouterOutputs } from '@gloe/api-client';
import { useEffect, useRef, useState } from 'react';

import { trpc } from '../../../lib/trpc';

type Refund = RouterOutputs['admin']['listRefunds'][number];

type Outcome = 'all' | 'succeeded' | 'refused';

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'succeeded', label: 'Refunded' },
  { key: 'refused',   label: 'Blocked attempts' },
];

interface RefundsViewProps {
  /**
   * Transaction id to scroll to + highlight when jumped here from another tab.
   * Callers (support drawer, customer view) know the transactionId of the order,
   * not the audit-row id, so we match the most-recent refund on that transaction.
   */
  highlightTransactionId?: string | null;
  /** Clears the highlight once consumed, so re-renders don't re-trigger it. */
  onHighlightConsumed?: () => void;
  /** Click a customer name → jump to the Customers tab + open that drawer. */
  onJumpToCustomer?: (customerId: string) => void;
}

export function RefundsView({ highlightTransactionId, onHighlightConsumed, onJumpToCustomer }: RefundsViewProps) {
  // If we arrived via a cross-link, force the filter to "All" so the target row
  // (which could be a partial, full, or even a blocked attempt) is guaranteed visible.
  const [outcome, setOutcome] = useState<Outcome>('all');
  useEffect(() => {
    if (highlightTransactionId) setOutcome('all');
  }, [highlightTransactionId]);

  const list = trpc.admin.listRefunds.useQuery({
    outcome: outcome === 'all' ? undefined : outcome,
    limit: 200,
  });

  const rows = list.data ?? [];

  // The audit row to flash: the most recent (rows are DESC) refund on the target txn.
  const highlightId = highlightTransactionId
    ? (rows.find((r) => r.transactionId === highlightTransactionId)?.id ?? null)
    : null;

  // Totals for the summary strip (successful refunds only).
  const succeeded = rows.filter((r) => r.succeeded);
  const totalRefundedCents = succeeded.reduce((sum, r) => sum + r.amountCents, 0);
  const fullCount = succeeded.filter((r) => r.isFullRefund).length;
  const partialCount = succeeded.filter((r) => !r.isFullRefund).length;
  const redeemedThenRefunded = succeeded.filter((r) => r.wasRedeemedBeforeRefund).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Refunds</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Every refund and partial refund — who issued it, when, against which order, and whether the voucher was already redeemed.
        </p>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat label="Total refunded" value={money(totalRefundedCents)} tone="error" />
        <Stat label="Refunds" value={String(succeeded.length)} />
        <Stat label="Full / Partial" value={`${fullCount} / ${partialCount}`} />
        <Stat label="Redeemed then refunded" value={String(redeemedThenRefunded)} tone={redeemedThenRefunded > 0 ? 'warn' : undefined} />
      </div>

      {/* Outcome filter */}
      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: outcome === o.key ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
                background: outcome === o.key ? 'var(--brand-500)' : 'var(--surface-elevated)',
                color: outcome === o.key ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div style={tableShell}>
        {list.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No refunds match.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Vendor</Th>
                <Th>Amount</Th>
                <Th>Type</Th>
                <Th>Redeemed?</Th>
                <Th>Issued by</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RefundRow
                  key={r.id}
                  r={r}
                  highlighted={!!highlightId && r.id === highlightId}
                  onHighlightConsumed={onHighlightConsumed}
                  onJumpToCustomer={onJumpToCustomer}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RefundRow({
  r,
  highlighted,
  onHighlightConsumed,
  onJumpToCustomer,
}: {
  r: Refund;
  highlighted: boolean;
  onHighlightConsumed?: () => void;
  onJumpToCustomer?: (customerId: string) => void;
}) {
  const rowRef = useRef<HTMLTableRowElement | null>(null);

  // When this row is the cross-link target, scroll it into view + flash it.
  useEffect(() => {
    if (!highlighted) return;
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => onHighlightConsumed?.(), 2400);
    return () => clearTimeout(t);
  }, [highlighted, onHighlightConsumed]);

  const refunded = r.succeeded;
  const redeemed = r.wasRedeemedBeforeRefund;

  return (
    <tr
      ref={rowRef}
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: highlighted ? 'var(--brand-50)' : 'transparent',
        outline: highlighted ? '2px solid var(--brand-400, var(--brand-500))' : 'none',
        transition: 'background 400ms ease, outline-color 400ms ease',
      }}
    >
      <Td>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
          {new Date(r.refundedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </Td>
      <Td>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.dealTitle ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
          {r.claimDisplayId ?? r.transactionDisplayId ?? '—'}
          {r.orderPlacedAt ? <span> · bought {new Date(r.orderPlacedAt).toLocaleDateString([], { dateStyle: 'short' })}</span> : null}
        </div>
      </Td>
      <Td>
        {r.customerId && onJumpToCustomer ? (
          <button onClick={() => onJumpToCustomer(r.customerId!)} style={linkBtn}>
            {r.customerName ?? r.customerEmail ?? 'Customer'}
          </button>
        ) : (
          <span>{r.customerName ?? r.customerEmail ?? '—'}</span>
        )}
      </Td>
      <Td>
        {r.vendorId ? (
          <a href={`/admin/vendor/${r.vendorId}`} style={{ color: 'var(--brand-600)', textDecoration: 'none' }}>{r.vendorName ?? '—'}</a>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>{r.vendorName ?? '—'}</span>
        )}
      </Td>
      <Td>
        <span style={{ fontWeight: 700, color: refunded ? 'var(--error)' : 'var(--text-tertiary)' }}>
          {refunded ? `−${money(r.amountCents)}` : money(r.amountCents)}
        </span>
        {r.consumerPaidCents ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>of {money(r.consumerPaidCents)}</div>
        ) : null}
      </Td>
      <Td>
        {!refunded ? (
          <Pill text="Blocked" bg="rgba(218,79,71,0.12)" color="var(--error)" />
        ) : r.isFullRefund ? (
          <Pill text="Full" bg="rgba(218,79,71,0.12)" color="var(--error)" />
        ) : (
          <Pill text="Partial" bg="rgba(201,138,52,0.14)" color="var(--brand-600)" />
        )}
      </Td>
      <Td>
        {redeemed ? (
          <span title={`Redeemed ${new Date(r.redeemedAt!).toLocaleString()}`} style={{ color: 'var(--brand-600)', fontWeight: 600, fontSize: 12 }}>
            ⚠ Yes
          </span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No</span>
        )}
        {r.claimStatus ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{r.claimStatus}</div>
        ) : null}
      </Td>
      <Td><span style={{ color: 'var(--text-secondary)' }}>{r.actorName ?? 'system'}</span></Td>
      <Td>
        <span style={{ color: refunded ? 'var(--text-secondary)' : 'var(--error)', fontSize: 12 }} title={(refunded ? r.reason : r.refusedReason) ?? ''}>
          {clip((refunded ? r.reason : r.refusedReason) ?? '—', 48)}
        </span>
        {r.stripeRefundId ? (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{r.stripeRefundId}</div>
        ) : null}
      </Td>
    </tr>
  );
}

/* ─────────────── small bits ─────────────── */

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'error' | 'warn' }) {
  const color = tone === 'error' ? 'var(--error)' : tone === 'warn' ? 'var(--brand-600)' : 'var(--text-primary)';
  return (
    <div style={{
      flex: '1 1 160px', minWidth: 140,
      padding: '12px 14px',
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Pill({ text, bg, color }: { text: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color }}>
      {text}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '10px 12px',
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky', top: 0, background: 'var(--surface-elevated)',
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{children}</td>;
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
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
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  color: 'var(--brand-600)', fontWeight: 600, fontSize: 13,
  cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationStyle: 'dotted',
};
