'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

/**
 * Dispute / chargeback context for a transaction (GLO-34). Rendered in the
 * god-mode transaction drawer whenever a Stripe dispute exists.
 *
 * The webhook (charge.dispute.*) already did the automatic work: it froze any
 * unredeemed voucher and halted the vendor payout (transaction → `disputed`).
 * This panel is the human surface:
 *   - shows the dispute reason / status / timeline,
 *   - explains what was auto-handled,
 *   - and, when the dispute was LOST but the vendor already got paid (a transfer
 *     exists), offers the owner-only "claw back the vendor's share" action that
 *     reconciles the loss (admin.reconcileLostDispute).
 *
 * It does NOT issue a customer refund — on a lost dispute Stripe already pulled
 * the funds, so a second refund would double-pay. (Use RefundControl for the
 * comp / partial cases that aren't disputes.)
 */
export function DisputePanel({
  disputeStatus,
  disputeReason,
  disputedAt,
  disputeResolvedAt,
  stripeDisputeId,
  txStatus,
  hasTransfer,
  transactionId,
  onDone,
}: {
  disputeStatus: string | null;
  disputeReason: string | null;
  disputedAt: string | null;
  disputeResolvedAt: string | null;
  stripeDisputeId: string;
  txStatus: string;
  hasTransfer: boolean;
  transactionId: string;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const reconcile = trpc.admin.reconcileLostDispute.useMutation();

  // The dispute resolved against us (lost / charge_refunded) and a vendor
  // transfer already went out → there's money to claw back.
  const lost = disputeStatus === 'lost' || disputeStatus === 'charge_refunded';
  const canReconcile = txStatus === 'disputed' && hasTransfer && lost;

  const submit = async () => {
    setError(null);
    try {
      const r = await reconcile.mutateAsync({ transactionId });
      setDone(`Clawed back ${money(r.reversedCents)} from the vendor.`);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reconcile failed.');
    }
  };

  return (
    <div style={wrap}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>⚠ Payment dispute</div>
      <div style={rowGrid}>
        <span style={k}>Status</span>
        <span style={{ ...v, color: lost ? 'var(--error)' : disputeStatus === 'won' ? 'var(--success)' : 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
          {disputeStatus ?? '—'}
        </span>
        <span style={k}>Reason</span>
        <span style={v}>{(disputeReason ?? '—').replace(/_/g, ' ')}</span>
        <span style={k}>Opened</span>
        <span style={v}>{disputedAt ? new Date(disputedAt).toLocaleString() : '—'}</span>
        <span style={k}>Resolved</span>
        <span style={v}>{disputeResolvedAt ? new Date(disputeResolvedAt).toLocaleString() : '—'}</span>
        <span style={k}>Dispute</span>
        <span style={{ ...v, fontFamily: 'monospace', fontSize: 11 }}>{stripeDisputeId}</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
        Unredeemed vouchers on this order were frozen and the vendor payout was halted automatically.
        {disputeStatus === 'won' ? ' We won — vouchers were un-frozen and the payout can release.' : ''}
      </div>

      {canReconcile && !done ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--accent-500)', background: 'rgba(180,120,40,0.10)', padding: '8px 10px', borderRadius: 'var(--radius-md)', lineHeight: 1.45 }}>
            Dispute lost, but the vendor was <strong>already paid</strong> for this order (a transfer exists). Stripe has pulled
            the charge back from the platform. Claw back the vendor&apos;s share so the loss doesn&apos;t sit on Gloē. Owner-only.
          </div>
          {error ? <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={submit} disabled={reconcile.isPending} style={dangerBtn}>
              {reconcile.isPending ? 'Reversing…' : 'Claw back vendor share'}
            </button>
          </div>
        </>
      ) : null}

      {done ? <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ {done}</div> : null}
    </div>
  );
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10,
  border: '1px solid var(--error)', borderRadius: 'var(--radius-md)',
  background: 'rgba(200,60,50,0.06)', padding: 12,
};
const rowGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'baseline',
};
const k: React.CSSProperties = { fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' };
const v: React.CSSProperties = { fontSize: 13, color: 'var(--text-primary)' };
const dangerBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--radius-md)',
  border: '1px solid var(--error)', background: 'var(--error)', color: '#fff', cursor: 'pointer',
};
