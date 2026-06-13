'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../../lib/trpc';
import { AdminChrome } from '../../console/AdminChrome';
import { UserLedger } from '../../console/CreditsView';
import { CopyableId } from '../../components/CopyableId';

/**
 * Customer 360 (GLO-56) — the complete file on one customer, as a full page
 * (Ryan: no drawers). Everything visible: purchases with their cash/credit/
 * promo split, every voucher, refund history, the credit ledger, referral
 * picture. Everything actionable inline: partial/full refunds, credit grant/
 * revoke (via the embedded wallet panel), ledger freeze, one-off push.
 */

type Detail = NonNullable<RouterOutputs['admin']['customerDetail']>;
type Txn = Detail['transactions'][number];
type Voucher = Detail['vouchers'][number];

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const VOUCHER_TONE: Record<string, string> = {
  active: 'var(--success)',
  redeemed: 'var(--brand-600)',
  expired: 'var(--text-tertiary)',
  cancelled: 'var(--error)',
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const q = trpc.admin.customerDetail.useQuery({ id });
  const d = q.data;

  const [pushOpen, setPushOpen] = useState(false);
  const freeze = trpc.admin.setCreditFreeze.useMutation({
    onSuccess: () => {
      void utils.admin.customerDetail.invalidate({ id });
      void utils.admin.creditUserLedger.invalidate({ userId: id });
    },
  });

  const name = d ? [d.customer.firstName, d.customer.lastName].filter(Boolean).join(' ') || (d.customer.email ?? '—') : '';

  return (
    <AdminChrome active="customers">
      <div style={{ maxWidth: 1040, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <button onClick={() => router.push('/admin?tab=customers')} style={backLink}>← All customers</button>

        {!d ? (
          <div style={{ color: 'var(--text-tertiary)' }}>{q.isLoading ? 'Loading…' : 'Customer not found.'}</div>
        ) : (
          <>
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {name}
                  {d.customer.creditFrozen ? <Flag color="var(--error)">Ledger frozen</Flag> : null}
                  {d.customer.deleted ? <Flag color="var(--text-tertiary)">Deleted account</Flag> : null}
                </h1>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
                  {d.customer.email ?? '—'} · {d.customer.phone ?? 'no phone'} · joined {new Date(d.customer.createdAt).toLocaleDateString()}
                  {d.customer.lastCity && d.customer.lastLocationAt ? (
                    <> · last seen near <strong style={{ color: 'var(--text-secondary)' }}>{d.customer.lastCity}</strong> ({new Date(d.customer.lastLocationAt).toLocaleDateString()})</>
                  ) : null}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
                  Referral code <strong>{d.customer.referralCode ?? '—'}</strong>
                  {d.referral.referrerName ? <> · referred by <strong>{d.referral.referrerName}</strong></> : null}
                  {d.referral.refereeCount > 0 ? <> · brought in <strong>{d.referral.refereeCount}</strong> {d.referral.refereeCount === 1 ? 'person' : 'people'}</> : null}
                </div>
                <div style={{ marginTop: 8 }}>
                  <CopyableId id={d.customer.displayId} label="Customer" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setPushOpen(true)} style={primaryBtn}>Send push</button>
                <button
                  onClick={() => freeze.mutate({ userId: id, frozen: !d.customer.creditFrozen })}
                  disabled={freeze.isPending}
                  style={d.customer.creditFrozen ? primaryBtn : dangerOutlineBtn}
                >
                  {freeze.isPending ? '…' : d.customer.creditFrozen ? 'Unfreeze ledger' : 'Freeze ledger'}
                </button>
              </div>
            </div>

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Stat label="Lifetime spend" value={money(d.totals.lifetime_paid_cents)} hero />
              <Stat label="Purchases" value={String(d.totals.purchase_count)} />
              <Stat label="Redemptions" value={String(d.totals.redemption_count)} />
              <Stat label="Refunded" value={money(d.totals.refunded_cents)} />
              <Stat label="Wallet credit" value={money(d.referral.creditBalanceCents)} />
            </div>

            <DuplicateChargeAlerts transactions={d.transactions} />

            {/* ── Purchases ── */}
            <section>
              <h2 style={sectionH}>Purchases ({d.transactions.length})</h2>
              {d.transactions.length === 0 ? (
                <Empty>No purchases yet.</Empty>
              ) : (
                <div style={tableShell}>
                  {d.transactions.map((t) => (
                    <PurchaseRow key={t.id} t={t} onChanged={() => q.refetch()} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Vouchers ── */}
            <section>
              <h2 style={sectionH}>Vouchers ({d.vouchers.length})</h2>
              {d.vouchers.length === 0 ? (
                <Empty>No vouchers.</Empty>
              ) : (
                <div style={tableShell}>
                  {d.vouchers.map((v) => <VoucherRow key={v.id} v={v} />)}
                </div>
              )}
            </section>

            {/* ── Credits ── */}
            <section>
              <h2 style={sectionH}>Wallet credits</h2>
              <div style={{ ...tableShell, padding: 16 }}>
                <UserLedger userId={id} />
              </div>
            </section>
          </>
        )}
      </div>

      {pushOpen && d ? (
        <PushModal userId={id} customerName={name} onClose={() => setPushOpen(false)} />
      ) : null}
    </AdminChrome>
  );
}

/* ───────────────────────── Purchases ───────────────────────── */

function PurchaseRow({ t, onChanged }: { t: Txn; onChanged: () => void }) {
  const router = useRouter();
  const [refundOpen, setRefundOpen] = useState(false);
  // UX gate only — the server recomputes the true refundable ceiling (cash +
  // credit split, platform-promo share excluded) and refuses anything over.
  const remaining = t.consumerPaidCents - t.refundedCents;
  const isVoucherRedeemed = t.claimStatus === 'redeemed';
  const canRefund = remaining > 0 && !isVoucherRedeemed && (t.status === 'paid' || t.status === 'partially_refunded');
  const cashCents = t.consumerPaidCents - t.creditsAppliedCents;

  return (
    <>
      <div style={rowShell}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.dealTitle ?? t.vendorName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            <a href={`/admin/vendor/${t.vendorId}`} style={inlineLink}>{t.vendorName}</a>
            {' · '}{t.paidAt ? new Date(t.paidAt).toLocaleString() : 'pending'}
            {' · '}{t.status}
            {t.claimStatus ? <> · voucher {t.claimStatus}</> : null}
            {t.refundedCents > 0 ? (
              <button
                onClick={() => router.push(`/admin?tab=refunds&refundTxn=${t.id}`)}
                title="View refund record"
                style={refundJump}
              >
                {' · refunded '}{money(t.refundedCents)} ↗
              </button>
            ) : null}
          </div>
          {(t.creditsAppliedCents > 0 || t.promoDiscountCents > 0) ? (
            <div style={{ fontSize: 11, color: 'var(--brand-600)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {t.promoDiscountCents > 0 ? `promo −${money(t.promoDiscountCents)}` : null}
              {t.promoDiscountCents > 0 && t.creditsAppliedCents > 0 ? ' · ' : null}
              {t.creditsAppliedCents > 0 ? `credits −${money(t.creditsAppliedCents)} · card ${money(cashCents)}` : null}
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(t.consumerPaidCents)}</div>
        {canRefund ? <button onClick={() => setRefundOpen(true)} style={smallBtn}>Refund</button> : null}
      </div>
      {refundOpen ? (
        <RefundModal
          transactionId={t.id}
          maxRefundableCents={t.consumerPaidCents - t.refundedCents}
          alreadyRefundedCents={t.refundedCents}
          dealTitle={t.dealTitle ?? t.vendorName}
          onClose={() => setRefundOpen(false)}
          onDone={() => { setRefundOpen(false); onChanged(); }}
        />
      ) : null}
    </>
  );
}

/* ───────────────────────── Vouchers ───────────────────────── */

function VoucherRow({ v }: { v: Voucher }) {
  return (
    <div style={rowShell}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {v.dealTitle ?? '—'}
          {v.variantLabel ? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> · {v.variantLabel}</span> : null}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {v.vendorName} · bought {new Date(v.createdAt).toLocaleDateString()}
          {v.status === 'redeemed' && v.redeemedAt
            ? <> · redeemed {new Date(v.redeemedAt).toLocaleDateString()}</>
            : <> · expires {new Date(v.expiresAt).toLocaleDateString()}</>}
        </div>
      </div>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{v.humanCode}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: VOUCHER_TONE[v.status] ?? 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {v.status}
      </span>
    </div>
  );
}

/* ───────────────────────── Push modal ───────────────────────── */

function PushModal({ userId, customerName, onClose }: { userId: string; customerName: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const send = trpc.admin.sendCustomerPush.useMutation({
    onSuccess: (r) => {
      if (r.status === 'sent') {
        setResult(r.sent > 0 ? `Delivered to ${r.sent} device${r.sent === 1 ? '' : 's'}.` : 'No registered devices — they may not have the app installed or notifications enabled.');
      } else {
        setResult('Queued.');
      }
    },
  });
  const canSend = title.trim().length > 0 && body.trim().length > 0 && !send.isPending;

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <h2 style={{ fontSize: 19 }}>Push to {customerName}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '4px 0 12px' }}>
          Sends immediately to their phone via the notification registry. Logged to the audit trail.
        </p>
        <label style={fieldLabel}>
          <span style={fieldEyebrow}>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Quick note from Gloē" style={fieldInput} />
        </label>
        <label style={{ ...fieldLabel, marginTop: 10 }}>
          <span style={fieldEyebrow}>Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={220} rows={3} placeholder="Your voucher is waiting — show the QR at the front desk ✨" style={{ ...fieldInput, resize: 'vertical' }} />
        </label>
        {send.error ? <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>{send.error.message}</div> : null}
        {result ? <div style={{ marginTop: 10, fontSize: 13, color: 'var(--brand-600)', fontWeight: 600 }}>{result}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryBtn}>{result ? 'Done' : 'Cancel'}</button>
          {!result ? (
            <button onClick={() => send.mutate({ userId, title: title.trim(), body: body.trim() })} disabled={!canSend} style={{ ...primaryBtn, opacity: canSend ? 1 : 0.5 }}>
              {send.isPending ? 'Sending…' : 'Send push'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Refund modal ───────────────────────── */

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
  const isValid = Number.isFinite(amountCents) && amountCents > 0 && amountCents <= maxRefundableCents && reason.trim().length >= 3;
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
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div>
          <h2 style={{ fontSize: 19, marginBottom: 2 }}>Refund transaction</h2>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{dealTitle}</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
          Refundable balance: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(maxRefundableCents)}</strong>
          {alreadyRefundedCents > 0 ? <span> · already refunded {money(alreadyRefundedCents)}</span> : null}
        </div>

        <label style={{ ...fieldLabel, marginTop: 12 }}>
          <span style={fieldEyebrow}>Amount (USD)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>$</span>
            <input
              type="number" min="0.01" step="0.01" max={(maxRefundableCents / 100).toFixed(2)}
              value={amountInput} onChange={(e) => setAmountInput(e.target.value)}
              style={{ ...fieldInput, fontSize: 16 }}
            />
            <button type="button" onClick={() => setAmountInput((maxRefundableCents / 100).toFixed(2))} style={smallBtn}>Max</button>
          </div>
        </label>

        <label style={{ ...fieldLabel, marginTop: 10 }}>
          <span style={fieldEyebrow}>Reason (required, ≥3 chars)</span>
          <input
            type="text" placeholder="e.g. customer asked, spa closed, duplicate charge"
            value={reason} onChange={(e) => setReason(e.target.value)} maxLength={280}
            style={fieldInput}
          />
        </label>

        {error ? (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--error)', padding: '8px 10px', background: 'rgba(218,79,71,0.08)', borderRadius: 'var(--radius-md)' }}>{error}</div>
        ) : null}

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4, marginTop: 10 }}>
          {isFull
            ? 'Full refund — voucher is cancelled; cash returns to the card, any credit share returns to the wallet. Gloē keeps the platform fee.'
            : 'Partial refund — voucher stays active for the kept portion. Cash first, then credits. Gloē keeps the platform fee.'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={onClose} disabled={refund.isPending} style={secondaryBtn}>Cancel</button>
          <button
            type="button" onClick={submit} disabled={!isValid || refund.isPending}
            style={{ ...primaryBtn, opacity: isValid ? 1 : 0.5 }}
          >
            {refund.isPending ? 'Refunding…' : isFull ? `Refund ${money(amountCents)}` : `Refund ${money(amountCents)} (partial)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Duplicate-charge alert ───────────────────────── */

function DuplicateChargeAlerts({ transactions }: { transactions: Txn[] }) {
  const WINDOW_MS = 5 * 60 * 1000;
  const recent = transactions.filter((t) => {
    const at = t.paidAt ?? t.createdAt;
    return new Date(at).getTime() > Date.now() - 14 * 24 * 3600 * 1000;
  }).sort((a, b) => new Date(a.paidAt ?? a.createdAt).getTime() - new Date(b.paidAt ?? b.createdAt).getTime());

  const clusters: Array<typeof recent> = [];
  let current: typeof recent = [];
  for (const t of recent) {
    const at = new Date(t.paidAt ?? t.createdAt).getTime();
    const prev = current[current.length - 1];
    if (!prev) { current = [t]; continue; }
    const prevAt = new Date(prev.paidAt ?? prev.createdAt).getTime();
    if (at - prevAt <= WINDOW_MS) current.push(t);
    else { if (current.length >= 2) clusters.push(current); current = [t]; }
  }
  if (current.length >= 2) clusters.push(current);
  if (clusters.length === 0) return null;

  return (
    <div style={{ padding: '12px 14px', background: 'rgba(178,93,64,0.08)', border: '1px solid rgba(178,93,64,0.25)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-500)', marginBottom: 6 }}>⚠ Possible duplicate charges</div>
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

/* ───────────────────────── Bits & styles ───────────────────────── */

function Stat({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12 }}>
      <div style={{ fontSize: hero ? 22 : 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: hero ? 'var(--brand-600)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Flag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', background: color, padding: '3px 10px', borderRadius: 999 }}>
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '10px 0' }}>{children}</div>;
}

const sectionH: React.CSSProperties = { fontSize: 18, marginBottom: 8 };
const tableShell: React.CSSProperties = {
  background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)', padding: '2px 16px',
};
const rowShell: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
  borderBottom: '1px solid var(--border-subtle)',
};
const backLink: React.CSSProperties = {
  alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
  fontSize: 13, fontWeight: 600, color: 'var(--brand-600)', cursor: 'pointer',
};
const inlineLink: React.CSSProperties = { color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 600 };
const refundJump: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--error)',
  fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.5)', zIndex: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  width: 'min(460px, 92vw)', background: 'var(--surface-elevated)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 22,
};
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldEyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)',
};
const fieldInput: React.CSSProperties = {
  flex: 1, padding: '8px 10px', fontSize: 14,
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)', color: 'var(--text-primary)',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: 'white', cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer',
};
const dangerOutlineBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer',
};
const smallBtn: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '5px 10px',
  border: '1px solid var(--border-default)', borderRadius: 999,
  background: 'var(--surface-default)', color: 'var(--text-primary)', cursor: 'pointer',
};
