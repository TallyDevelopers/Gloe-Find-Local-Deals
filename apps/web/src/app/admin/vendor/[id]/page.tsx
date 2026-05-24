'use client';

import { UserButton } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card } from '../../../../components/ui';
import { Wordmark } from '../../../../components/Wordmark';
import { trpc } from '../../../../lib/trpc';
import { FeeTiersEditor } from '../../components/FeeTiersEditor';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const DEAL_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Live', color: 'var(--success)' },
  pending_review: { label: 'In review', color: 'var(--brand-500)' },
  draft: { label: 'Draft', color: 'var(--text-tertiary)' },
  paused: { label: 'Paused', color: 'var(--text-tertiary)' },
  expired: { label: 'Expired', color: 'var(--text-tertiary)' },
  sold_out: { label: 'Sold out', color: 'var(--accent-500)' },
  rejected: { label: 'Rejected', color: 'var(--error)' },
};

export default function VendorDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const q = trpc.admin.vendorDetail.useQuery({ vendorId: id });
  const data = q.data;
  const suspend = trpc.admin.setVendorSuspended.useMutation({
    onSuccess: () => {
      void utils.admin.vendorDetail.invalidate({ vendorId: id });
      void utils.admin.vendorRoster.invalidate();
    },
  });
  const suspended = data?.vendor.status === 'suspended';

  const onboard = trpc.admin.startVendorStripeOnboarding.useMutation({
    onSuccess: ({ onboardingUrl }) => {
      // Copy the link so you can text it to the spa; also open it for testing.
      void navigator.clipboard?.writeText(onboardingUrl).catch(() => {});
      window.open(onboardingUrl, '_blank');
    },
  });
  const startStripe = () => {
    const base = window.location.origin + `/admin/vendor/${id}`;
    onboard.mutate({ vendorId: id, refreshUrl: base, returnUrl: base });
  };

  const onToggleSuspend = () => {
    if (suspended) {
      suspend.mutate({ vendorId: id, suspended: false });
      return;
    }
    if (confirm(`Suspend ${data?.vendor.businessName}? This takes them offline and pulls every live post down to draft.`)) {
      suspend.mutate({ vendorId: id, suspended: true });
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15 }}>← Admin</button>
            <Wordmark size={22} tone="gold" />
          </div>
          <UserButton />
        </div>
      </header>

      <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!data ? (
          <p style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
        ) : (
          <>
            <div className="dash-header">
              <div>
                <h1 style={{ fontSize: 32 }}>{data.vendor.businessName}</h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 2 }}>
                  {data.vendor.addressLine1}, {data.vendor.city}, {data.vendor.region} · {data.vendor.phone}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {suspended ? <Tag ok={false} label="SUSPENDED" /> : null}
                  <Tag ok={data.vendor.hasOwner ? true : null} label={data.vendor.hasOwner ? 'claimed' : 'unclaimed'} />
                  <Tag ok={data.vendor.stripeConnected} label={data.vendor.stripeConnected ? 'Stripe connected' : 'Stripe NOT connected'} />
                  {data.vendor.adminBypass ? <Tag ok={true} label="gates open" /> : null}
                  <Tag ok={data.vendor.hasGoogle} label={data.vendor.hasGoogle ? 'google linked' : 'no google'} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {!data.vendor.stripeConnected ? (
                  <button
                    onClick={startStripe}
                    disabled={onboard.isPending}
                    title="Create their Stripe link & copy it to send"
                    style={{
                      padding: '9px 16px', fontSize: 14, fontWeight: 700, borderRadius: 999,
                      border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: '#fff',
                    }}
                  >
                    {onboard.isPending ? '…' : 'Connect Stripe'}
                  </button>
                ) : null}
                <button
                  onClick={onToggleSuspend}
                  disabled={suspend.isPending}
                  style={{
                    padding: '9px 16px', fontSize: 14, fontWeight: 700, borderRadius: 999,
                    border: suspended ? '1px solid var(--success)' : '1px solid var(--error)',
                    background: 'var(--surface-elevated)',
                    color: suspended ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {suspend.isPending ? '…' : suspended ? 'Reinstate' : 'Suspend'}
                </button>
                <Button onClick={() => router.push(`/admin/vendor/${id}/deal`)}>+ Post a deal</Button>
              </div>
            </div>

            {/* Money */}
            <div className="admin-stat-grid">
              <MoneyCard label="They've earned" value={money(data.vendor.vendorEarnedCents)} hero />
              <MoneyCard label="Gross sales" value={money(data.vendor.grossCents)} />
              <MoneyCard label="My income from them" value={money(data.vendor.incomeCents)} />
            </div>

            {/* Payout health */}
            <Card>
              <h2 style={{ fontSize: 19, marginBottom: 12 }}>Payouts</h2>
              {!data.vendor.stripeConnected ? (
                <div style={{ background: 'rgba(178,93,64,0.1)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 14, color: 'var(--accent-500)', fontWeight: 600 }}>
                  ⚠ Stripe not connected — {money(data.vendor.vendorEarnedCents)} is being held until they connect. Time to call them.
                </div>
              ) : (
                <>
                  <StripeLiveBalance vendorId={id} />
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <PayoutStat label="Paid out" value={money(data.vendor.payoutPaidCents)} />
                    <PayoutStat label="Pending / in transit" value={money(data.vendor.payoutPendingCents)} />
                    <PayoutStat label="Failed payouts" value={String(data.vendor.payoutFailedCount)} alert={data.vendor.payoutFailedCount > 0} />
                  </div>
                </>
              )}

              {data.vendor.payoutFailures.length > 0 ? (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.vendor.payoutFailures.map((f) => (
                    <div key={f.id} style={{ border: '1px solid rgba(178,69,69,0.3)', background: 'rgba(178,69,69,0.06)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--error)' }}>
                        Payout of {money(f.amountCents)} failed
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {f.message ?? 'No reason given by Stripe.'} · {new Date(f.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>

            <ReleaseControls
              vendorId={id}
              autoRelease={data.vendor.autoReleaseOnRedemption}
              heldPayouts={data.heldPayouts}
            />

            <FeeTiersEditor vendorId={id} />

            <ReconciliationPanel vendorId={id} />

            <WindDownPanel vendorId={id} vendorName={data.vendor.businessName} />

            {/* Listings */}
            <Card>
              <h2 style={{ fontSize: 19, marginBottom: 16 }}>Listings ({data.deals.length})</h2>
              {data.deals.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>No deals yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {data.deals.map((d, i) => {
                    const st = DEAL_STATUS[d.status] ?? DEAL_STATUS.draft;
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i === data.deals.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', flexShrink: 0, background: d.primaryPhotoUrl ? `center/cover url(${d.primaryPhotoUrl})` : 'var(--surface-secondary)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{d.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                            {d.categoryName} · {d.minPriceCents != null ? money(d.minPriceCents) : '—'} · {d.purchases} sold
                          </div>
                        </div>
                        <span style={{ color: st?.color, fontSize: 13, fontWeight: 600 }}>{st?.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function ReconciliationPanel({ vendorId }: { vendorId: string }) {
  const q = trpc.admin.vendorReconciliation.useQuery({ vendorId });
  const d = q.data;
  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Reconciliation</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 14 }}>
        Our DB records vs Stripe's live view. If these don't match, money state is drifting.
      </p>
      {q.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)' }}>Loading from Stripe…</div>
      ) : !d ? (
        <div style={{ color: 'var(--text-tertiary)' }}>No reconciliation data.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
            <Tile label={`Our DB recorded (${d.dbTransferCount})`} value={money(d.dbTransferredCents)} />
            <Tile label={`Stripe gross (${d.stripeTransferCount})`} value={money(d.stripeSentCents)} />
            <Tile label="Reversed on Stripe" value={money(d.stripeReversedCents)} />
            <Tile label="Stripe net" value={money(d.stripeNetCents)} hero />
          </div>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: d.isReconciled ? 'rgba(76, 145, 95, 0.08)' : 'rgba(178,69,69,0.08)',
              border: d.isReconciled ? '1px solid rgba(76, 145, 95, 0.25)' : '1px solid rgba(178,69,69,0.25)',
            }}
          >
            {d.isReconciled ? (
              <div style={{ color: 'var(--success)', fontSize: 14, fontWeight: 700 }}>
                ✓ Reconciled — our DB matches Stripe exactly.
              </div>
            ) : (
              <>
                <div style={{ color: 'var(--error)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  ⚠ Delta of {money(Math.abs(d.deltaCents))} {d.deltaCents > 0 ? '— we recorded MORE than Stripe shows' : '— Stripe shows MORE than we recorded'}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {d.deltaCents > 0
                    ? 'A transfer may have been reversed by Stripe (insufficient funds, account dispute) and we didn\'t catch it. Compare our payouts list with Stripe → Connect → Transfers.'
                    : 'Stripe shows more transfers than we have in the DB. A transfer may have happened without our DB recording it (manual Stripe action). Audit the recent transfers.'}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function WindDownPanel({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const wind = trpc.admin.windDownVendor.useMutation({
    onSuccess: () => {
      void utils.admin.vendorDetail.invalidate({ vendorId });
      void utils.admin.vendorRoster.invalidate();
      setOpen(false);
      setReason('');
    },
  });

  return (
    <Card style={{ border: '1px solid rgba(178,69,69,0.25)' }}>
      <h2 style={{ fontSize: 19, marginBottom: 4, color: 'var(--error)' }}>Wind down</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
        Refund every active (unredeemed) voucher for this vendor and suspend them. Cannot be undone.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)} style={dangerBtn}>Begin wind-down…</button>
      ) : (
        <div style={{ background: 'rgba(178,69,69,0.05)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Wind down {vendorName}?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            This will refund every active voucher (Stripe PaymentIntent refund), mark them cancelled, and suspend the vendor. Customers are charged again on their cards (refund posts in 5-10 business days). Audit log captures every refund.
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are we winding them down? (audit only)"
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-default)', marginBottom: 10,
            }}
          />
          {wind.error ? (
            <div style={{ fontSize: 13, color: 'var(--error)', marginBottom: 8 }}>{wind.error.message}</div>
          ) : null}
          {wind.data ? (
            <div style={{ fontSize: 13, padding: 10, background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                ✓ Refunded {wind.data.refunded.length} voucher{wind.data.refunded.length === 1 ? '' : 's'}
              </div>
              {wind.data.failed.length > 0 ? (
                <div style={{ color: 'var(--error)', marginTop: 6 }}>
                  ⚠ {wind.data.failed.length} refund{wind.data.failed.length === 1 ? '' : 's'} failed — see audit log
                </div>
              ) : null}
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                Vendor is now suspended.
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setOpen(false); setReason(''); }} style={ghostBtn}>Cancel</button>
            <button
              onClick={() => {
                if (confirm(`Refund all active vouchers for ${vendorName} and suspend? This cannot be undone.`)) {
                  wind.mutate({ vendorId, reason });
                }
              }}
              disabled={wind.isPending || !reason.trim() || (!!wind.data)}
              style={dangerBtn}
            >
              {wind.isPending ? 'Working…' : wind.data ? 'Done' : 'Refund all + suspend'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Tile({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div style={{ background: hero ? 'var(--brand-50)' : 'var(--surface-default)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12 }}>
      <div style={{ fontSize: hero ? 22 : 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: hero ? 'var(--brand-600)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const dangerBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--error)', background: 'var(--error)', color: 'white',
  cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
};

function StripeLiveBalance({ vendorId }: { vendorId: string }) {
  const q = trpc.admin.vendorStripeMoney.useQuery({ vendorId });
  const available = q.data?.availableCents;
  const pending = q.data?.pendingCents;
  return (
    <div
      style={{
        background: 'var(--brand-50)',
        border: '1px solid var(--brand-100)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        marginBottom: 14,
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}
    >
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--brand-600)', marginBottom: 2 }}>
          ON THEIR STRIPE ACCOUNT (LIVE)
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brand-600)', fontVariantNumeric: 'tabular-nums' }}>
          {q.isLoading ? '…' : available == null ? '—' : money(available)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {pending != null && pending > 0 ? `+ ${money(pending)} pending` : 'Available for Stripe to pay out to their bank.'}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 280 }}>
        This is what Stripe shows the vendor RIGHT NOW. Stripe pays it to their bank on their payout schedule (default daily).
      </div>
    </div>
  );
}

function ReleaseControls({
  vendorId,
  autoRelease,
  heldPayouts,
}: {
  vendorId: string;
  autoRelease: boolean;
  heldPayouts: { claimId: string; amountCents: number; dealTitle: string | null; redeemedAt: string }[];
}) {
  const utils = trpc.useUtils();
  const setAuto = trpc.admin.setVendorAutoRelease.useMutation({
    onSuccess: () => {
      void utils.admin.vendorDetail.invalidate({ vendorId });
    },
  });
  const push = trpc.admin.pushHeldPayout.useMutation({
    onSuccess: () => {
      void utils.admin.vendorDetail.invalidate({ vendorId });
    },
  });
  const heldTotal = heldPayouts.reduce((sum, h) => sum + h.amountCents, 0);

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 12 }}>Release controls</h2>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '4px 0 14px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Auto-release on redemption</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
            When ON, a redeemed voucher immediately fires the Stripe Transfer to this vendor.
            When OFF, the money waits — push it manually below.
          </div>
        </div>
        <Toggle
          on={autoRelease}
          disabled={setAuto.isPending}
          onChange={(next) => setAuto.mutate({ vendorId, enabled: next })}
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            Waiting to release · {heldPayouts.length} · {money(heldTotal)}
          </div>
          {heldPayouts.length > 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {autoRelease ? 'Recent failures — retry below' : 'Auto-release is OFF — push when ready'}
            </span>
          ) : null}
        </div>

        {heldPayouts.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            No held payouts. Everything redeemed has been released.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {heldPayouts.map((h, i) => (
              <div
                key={h.claimId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: i === heldPayouts.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{h.dealTitle ?? 'Voucher'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Redeemed {new Date(h.redeemedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {money(h.amountCents)}
                </div>
                <button
                  onClick={() => push.mutate({ claimId: h.claimId })}
                  disabled={push.isPending}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 999,
                    border: '1px solid var(--brand-500)',
                    background: 'var(--brand-500)',
                    color: 'white',
                    opacity: push.isPending ? 0.5 : 1,
                  }}
                >
                  Push
                </button>
              </div>
            ))}
          </div>
        )}

        {push.error ? (
          <div
            style={{
              background: 'rgba(178,69,69,0.08)',
              border: '1px solid rgba(178,69,69,0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginTop: 12,
              fontSize: 13,
              color: 'var(--error)',
            }}
          >
            Couldn’t push: {push.error.message}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative',
        width: 46,
        height: 26,
        borderRadius: 999,
        border: 'none',
        background: on ? 'var(--brand-500)' : 'var(--surface-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 120ms',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 120ms',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function MoneyCard({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <Card style={hero ? { background: 'var(--brand-50)', border: '1px solid var(--brand-100)' } : undefined}>
      <div style={{ fontSize: hero ? 32 : 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: hero ? 'var(--brand-600)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{label}</div>
    </Card>
  );
}

function PayoutStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: alert ? 'var(--error)' : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  );
}

function Tag({ ok, label }: { ok: boolean | null; label: string }) {
  const c = ok === null ? 'var(--text-tertiary)' : ok ? 'var(--success)' : 'var(--accent-500)';
  const b = ok === null ? 'var(--surface-secondary)' : ok ? 'rgba(122,139,92,0.12)' : 'rgba(178,93,64,0.12)';
  return <span style={{ fontSize: 12, fontWeight: 700, color: c, background: b, padding: '4px 10px', borderRadius: 999 }}>{label}</span>;
}
