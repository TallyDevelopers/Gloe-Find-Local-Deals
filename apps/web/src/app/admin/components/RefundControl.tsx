'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Issue a refund on a transaction, from anywhere a transaction is in view.
 *
 * Two modes, chosen by `isRedeemed`:
 *  - Not redeemed → normal `admin.refundTransaction` (any admin).
 *  - Redeemed → `admin.forceRefundRedeemed` (OWNER-only): refunds the customer
 *    and, by default, claws back the vendor's share via a transfer reversal.
 *    The server enforces the owner gate; a moderator just sees the error.
 *
 * `consumerPaidCents` seeds the amount field (full refund by default); the
 * server is the source of truth on the actual refundable remaining balance.
 */
export function RefundControl({
  transactionId,
  consumerPaidCents,
  isRedeemed,
  onDone,
}: {
  transactionId: string;
  consumerPaidCents: number;
  isRedeemed: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState((consumerPaidCents / 100).toFixed(2));
  const [reason, setReason] = useState('');
  const [reverseTransfer, setReverseTransfer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const normal = trpc.admin.refundTransaction.useMutation();
  const force = trpc.admin.forceRefundRedeemed.useMutation();
  const busy = normal.isPending || force.isPending;

  const submit = async () => {
    setError(null);
    const amountCents = Math.round(parseFloat(dollars) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setError('Enter a valid amount.'); return; }
    if (reason.trim().length < 3) { setError('A reason (3+ chars) is required.'); return; }
    try {
      if (isRedeemed) {
        const r = await force.mutateAsync({ transactionId, amountCents, reason: reason.trim(), reverseTransfer });
        setDone(`Refunded ${money(r.amountCents)}${r.reversedCents ? ` · clawed back ${money(r.reversedCents)} from vendor` : ''}.`);
      } else {
        const r = await normal.mutateAsync({ transactionId, amountCents, reason: reason.trim() });
        setDone(`Refunded ${money(r.amountCents)}${r.isFullRefund ? ' · voucher cancelled' : ' · voucher stays active'}.`);
      }
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refund failed.');
    }
  };

  if (done) {
    return (
      <div style={{ ...wrap, borderColor: 'var(--success)' }}>
        <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ {done}</div>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={isRedeemed ? dangerBtn : refundBtn}>
        {isRedeemed ? 'Force refund (redeemed)' : 'Refund'}
      </button>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{isRedeemed ? 'Force refund a redeemed voucher' : 'Issue refund'}</div>
      {isRedeemed ? (
        <div style={{ fontSize: 12, color: 'var(--accent-500)', background: 'rgba(180,120,40,0.10)', padding: '8px 10px', borderRadius: 'var(--radius-md)', lineHeight: 1.45 }}>
          This voucher was <strong>already redeemed</strong> — the service was delivered. Refunding returns money to the
          customer. By default we also claw back the vendor's share (can push their Stripe balance negative). Owner-only.
        </div>
      ) : null}

      <label style={fieldLabel}>Amount
        <input
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          inputMode="decimal"
          style={input}
          disabled={busy}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Paid {money(consumerPaidCents)}. Enter less for a partial refund.</span>
      </label>

      <label style={fieldLabel}>Reason (logged)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. customer dispute, comped by founder"
          style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }}
          disabled={busy}
        />
      </label>

      {isRedeemed ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={reverseTransfer} onChange={(e) => setReverseTransfer(e.target.checked)} disabled={busy} />
          Claw back the vendor's share (transfer reversal). Uncheck to comp it on the platform.
        </label>
      ) : null}

      {error ? <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div> : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={() => { setOpen(false); setError(null); }} disabled={busy} style={cancelBtn}>Cancel</button>
        <button onClick={submit} disabled={busy} style={isRedeemed ? dangerBtn : refundBtn}>
          {busy ? 'Refunding…' : isRedeemed ? 'Force refund' : 'Issue refund'}
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10,
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)', padding: 12,
};
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' };
const input: React.CSSProperties = {
  padding: '8px 10px', fontSize: 14, border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
};
const refundBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--radius-md)',
  border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: '#fff', cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--radius-md)',
  border: '1px solid var(--error)', background: 'var(--error)', color: '#fff', cursor: 'pointer',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, border: '1px solid var(--border-subtle)', background: 'transparent',
  color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
};
