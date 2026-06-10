'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Card } from '../../../../components/ui';
import { trpc } from '../../../../lib/trpc';
import { AdminChrome } from '../../console/AdminChrome';
import { PhotoUploader } from '../../../vendor/post/PhotoUploader';
import { VendorVideosManager } from '../../../../components/vendor/VendorVideosManager';
import { CopyableId } from '../../components/CopyableId';
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
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const suspend = trpc.admin.setVendorSuspended.useMutation({
    onSuccess: () => {
      void utils.admin.vendorDetail.invalidate({ vendorId: id });
      void utils.admin.vendorRoster.invalidate();
    },
  });
  const setClawback = trpc.admin.setVendorAutoClawback.useMutation({
    onSuccess: () => { void utils.admin.vendorDetail.invalidate({ vendorId: id }); },
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
    <AdminChrome active="vendors">
      <div style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                <div style={{ marginTop: 8 }}>
                  <CopyableId id={data.vendor.displayId} label="Vendor" />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {suspended ? <Tag ok={false} label="SUSPENDED" /> : null}
                  <Tag ok={data.vendor.hasOwner ? true : null} label={data.vendor.hasOwner ? 'claimed' : 'unclaimed'} />
                  {!data.vendor.hasOwner ? (
                    <InviteOwnerButton
                      vendorId={id}
                      email={data.vendor.email}
                      invitedAt={data.vendor.ownerInvitedAt}
                    />
                  ) : null}
                  <Tag ok={data.vendor.stripeConnected} label={data.vendor.stripeConnected ? 'Stripe connected' : 'Stripe NOT connected'} />
                  <Tag
                    ok={data.vendor.license.status === 'verified' ? true : data.vendor.license.status === 'pending_review' ? null : false}
                    label={
                      data.vendor.license.status === 'verified' ? 'license verified'
                        : data.vendor.license.status === 'pending_review' ? 'license in review'
                        : data.vendor.license.status === 'rejected' ? 'license rejected'
                        : 'no license'
                    }
                  />
                  {data.vendor.adminBypass ? <Tag ok={true} label="gates open" /> : null}
                  <Tag ok={data.vendor.hasGoogle} label={data.vendor.hasGoogle ? 'google linked' : 'no google'} />
                  <GoogleLinkButton vendorId={id} linked={data.vendor.hasGoogle} />
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

            {/* Money — reading order: what came in → what left → what we kept → what's at risk. */}
            <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <MoneyCard label="Gross sales" value={money(data.vendor.grossCents)} hero />
              <MoneyCard label="Sent to vendor" value={money(data.vendor.vendorEarnedCents)} />
              <MoneyCard label="Gloē net (approx)" value={money(data.vendor.netIncomeCents)} />
              <MoneyCard label="Open disputes" value={String(data.vendor.disputeOpen)} />
            </div>

            {/* Two side-by-side card columns (flex, not grid, so card heights
                don't couple across columns). Wraps to one column when narrow. */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionLabel>Financials</SectionLabel>

            <Card>
              <h2 style={{ fontSize: 19, marginBottom: 4 }}>P&amp;L breakdown</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
                What hits Gloe's bank from this vendor's activity, before monthly Stripe charges.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <PnlRow label="Customers paid" value={money(data.vendor.grossCents)} />
                <PnlRow label="Sent to vendor" value={`−${money(data.vendor.vendorEarnedCents)}`} />
                <PnlRow label="Our platform fee" value={money(data.vendor.incomeCents)} subtle />
                <PnlRow label="Stripe card fee (per-transaction)" value={`−${money(data.vendor.stripeFeeCents)}`} subtle />
                <PnlRow label="Net to Gloe (approx)" value={money(data.vendor.netIncomeCents)} bold />
              </div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
                ⚠ Excludes monthly Express account fees ($2 / active vendor), 0.25% payout fees,
                instant-payout fees, refund flat fees, and chargebacks. For full accounting see
                Stripe Dashboard → Billing. We&apos;ll reconcile end-to-end before launch.
              </p>
            </Card>

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

            <ReleaseHistory releases={data.releases} />

            <ReconciliationPanel vendorId={id} />

            <FeeTiersEditor vendorId={id} />

            </div>
            <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionLabel>Risk &amp; controls</SectionLabel>

            <LicenseReviewCard vendorId={id} license={data.vendor.license} vendorStatus={data.vendor.status} />

            {/* Disputes / chargebacks — the "should I slash this vendor?" card. */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <h2 style={{ fontSize: 19 }}>Disputes</h2>
                {data.vendor.isHighDisputeRisk ? (
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: 'var(--error)', padding: '3px 10px', borderRadius: 999 }}>
                    ⚠ HIGH DISPUTE RATE
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <PayoutStat
                  label={`In last ${data.vendor.disputeRiskConfig.windowDays}d`}
                  value={String(data.vendor.disputeInWindow)}
                  alert={data.vendor.isHighDisputeRisk}
                />
                <PayoutStat label="All time" value={String(data.vendor.disputeTotal)} />
                <PayoutStat label="Open now" value={String(data.vendor.disputeOpen)} alert={data.vendor.disputeOpen > 0} />
                <PayoutStat label="Lost" value={String(data.vendor.disputeLost)} alert={data.vendor.disputeLost > 0} />
                <PayoutStat label="Rate" value={`${(data.vendor.disputeRate * 100).toFixed(1)}%`} alert={data.vendor.disputeRate > 0.01} />
              </div>

              {/* Auto-clawback toggle — on by default for every vendor. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0 4px', marginTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Auto-claw back on a lost dispute</div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    When ON and a dispute is <strong>lost</strong>, we automatically reverse this vendor&apos;s
                    transfer so the platform doesn&apos;t eat their share (their Stripe balance can go negative;
                    Stripe recoups it from their future sales). When OFF, we just flag it for you to claw back
                    manually from the Transactions tab. <strong>On by default for every vendor.</strong>
                  </div>
                </div>
                <Toggle
                  on={data.vendor.autoClawbackOnDisputeLost}
                  disabled={setClawback.isPending}
                  onChange={(next) => setClawback.mutate({ vendorId: id, enabled: next })}
                />
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12, marginBottom: 0 }}>
                {data.vendor.disputeRiskConfig.enabled ? (
                  data.vendor.isHighDisputeRisk ? (
                    <>Over your limit of <strong>{data.vendor.disputeRiskConfig.maxDisputes}</strong> in {data.vendor.disputeRiskConfig.windowDays} days.{' '}
                      {data.vendor.disputeLost > 0 || data.vendor.disputeOpen > 0
                        ? 'Reverse any vendor payouts on disputed orders from the Transactions tab, then consider winding them down below.'
                        : 'Watch them.'}</>
                  ) : (
                    <>Under your limit of <strong>{data.vendor.disputeRiskConfig.maxDisputes}</strong> in {data.vendor.disputeRiskConfig.windowDays} days. Tune the line in Settings → Dispute-risk flag.</>
                  )
                ) : (
                  <>Flagging is off (Settings → Dispute-risk flag). Counts shown for reference only.</>
                )}
                {data.vendor.lastDisputedAt ? <> · last dispute {new Date(data.vendor.lastDisputedAt).toLocaleDateString()}</> : null}
              </p>
            </Card>

            <ReleaseControls
              vendorId={id}
              autoRelease={data.vendor.autoReleaseOnRedemption}
              heldPayouts={data.heldPayouts}
            />

            <SectionLabel style={{ marginTop: 14 }}>Vendor content</SectionLabel>

            <GloeTakeEditor
              vendorId={id}
              initialTake={data.vendor.gloeTake}
              initialPerks={data.vendor.gloePerks}
              onSaved={() => utils.admin.vendorDetail.invalidate({ vendorId: id })}
            />

            <VendorVideosCard vendorId={id} />

            {/* Listings */}
            <Card>
              <h2 style={{ fontSize: 19, marginBottom: 16 }}>Listings ({data.deals.length})</h2>
              {data.deals.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>No deals yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {data.deals.map((d, i) => {
                    const st = DEAL_STATUS[d.status] ?? DEAL_STATUS.draft;
                    const editable = d.status !== 'expired' && d.status !== 'sold_out';
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
                        {editable ? (
                          <button
                            onClick={() => setEditingDealId(d.id)}
                            style={{
                              fontSize: 12, fontWeight: 600,
                              padding: '6px 12px',
                              border: '1px solid var(--border-default)',
                              borderRadius: 999,
                              background: 'var(--surface-default)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Danger zone — the irreversible action lives at the very bottom, never mid-page. */}
            <SectionLabel style={{ marginTop: 14 }}>Danger zone</SectionLabel>
            <WindDownPanel vendorId={id} vendorName={data.vendor.businessName} />

            </div>
            </div>

            {editingDealId ? (
              <DealQuickEditModal
                dealId={editingDealId}
                onClose={() => setEditingDealId(null)}
                onSaved={() => {
                  setEditingDealId(null);
                  void utils.admin.vendorDetail.invalidate({ vendorId: id });
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </AdminChrome>
  );
}

type Release = {
  transactionId: string;
  transactionDisplayId: string;
  amountCents: number;
  dealTitle: string | null;
  customerEmail: string | null;
  stripeTransferId: string;
  releasedAt: string;
};

/**
 * Full history of money moved from the Gloe platform balance to this vendor's
 * Connect account. Surfaced so support can answer "where's my money?" by
 * citing a date and Stripe transfer id — every release is forensic-grade.
 */
/**
 * GLO-5: invite the owner of an unclaimed vendor. Prompts for the email if
 * none is on file, fires the Clerk invitation, and shows when one went out.
 * When the owner signs in at /vendor with that (verified) email, the
 * business links to them automatically.
 */
function InviteOwnerButton({
  vendorId,
  email,
  invitedAt,
}: {
  vendorId: string;
  email: string | null;
  invitedAt: string | null;
}) {
  const utils = trpc.useUtils();
  const invite = trpc.admin.inviteVendorOwner.useMutation({
    onSuccess: ({ email: sent }) => {
      void utils.admin.vendorDetail.invalidate({ vendorId });
      alert(`Invite sent to ${sent}. When they sign in at /vendor, the business links automatically.`);
    },
    onError: (e) => alert(e.message),
  });

  const send = () => {
    let target = email;
    if (!target) {
      target = prompt("Owner's email — the invite goes here, and signing in with it claims the business:")?.trim() || null;
      if (!target) return;
    } else if (invitedAt && !confirm(`Re-send the invite to ${target}?`)) {
      return;
    }
    invite.mutate({
      vendorId,
      email: target === email ? null : target,
      // Must land on a PUBLIC page that mounts <SignUp> — it consumes the
      // __clerk_ticket (pre-verified email + password screen). /vendor itself
      // is auth-protected, so the ticket would be dropped at the middleware.
      redirectUrl: `${window.location.origin}/sign-up?redirect_url=${encodeURIComponent('/vendor')}`,
    });
  };

  return (
    <button
      onClick={send}
      disabled={invite.isPending}
      title={invitedAt ? `Invited ${new Date(invitedAt).toLocaleDateString()}${email ? ` (${email})` : ''}` : email ?? 'No owner email on file yet'}
      style={{
        padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 999,
        border: '1px solid var(--brand-500)', background: 'var(--surface-elevated)', color: 'var(--brand-600)',
        cursor: 'pointer',
      }}
    >
      {invite.isPending ? '…' : invitedAt ? `invited ${new Date(invitedAt).toLocaleDateString()} · resend` : '✉ Invite owner'}
    </button>
  );
}

/**
 * GLO-19: the admin half of license verification. Shows what the vendor
 * submitted (incl. a signed link to the doc in the private bucket) and the
 * Approve / Reject decision. Approving a pending_approval vendor also flips
 * them active — approval IS the "vetted & licensed" gate.
 */
function LicenseReviewCard({
  vendorId,
  license,
  vendorStatus,
}: {
  vendorId: string;
  license: {
    status: string;
    number: string | null;
    state: string | null;
    type: string | null;
    hasDocument: boolean;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  };
  vendorStatus: string;
}) {
  const utils = trpc.useUtils();
  const review = trpc.admin.reviewVendorLicense.useMutation({
    onSuccess: () => {
      void utils.admin.vendorDetail.invalidate({ vendorId });
      void utils.admin.vendorRoster.invalidate();
    },
    onError: (e) => {
      alert(e.message);
      void utils.admin.vendorDetail.invalidate({ vendorId });
    },
  });
  // Signed fresh at click time — a URL baked into the cached query would
  // expire while the admin cross-checks the state board.
  const docUrl = trpc.admin.licenseDocumentUrl.useMutation();
  const openDocument = async () => {
    const w = window.open('', '_blank'); // open synchronously so popup blockers allow it
    try {
      const { url } = await docUrl.mutateAsync({ vendorId });
      if (w) w.location.href = url;
      else window.open(url, '_blank');
    } catch (e) {
      w?.close();
      alert(e instanceof Error ? e.message : 'Could not open the document.');
    }
  };
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const statusChip = (() => {
    switch (license.status) {
      case 'verified':       return { label: 'VERIFIED', bg: 'var(--success)' };
      case 'pending_review': return { label: 'NEEDS REVIEW', bg: 'var(--accent-500)' };
      case 'rejected':       return { label: 'REJECTED', bg: 'var(--error)' };
      default:               return { label: 'NOT SUBMITTED', bg: 'var(--text-tertiary)' };
    }
  })();

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 19 }}>License &amp; verification</h2>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: statusChip.bg, padding: '3px 10px', borderRadius: 999 }}>
          {statusChip.label}
        </span>
      </div>

      {license.status === 'unverified' ? (
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
          Nothing submitted yet. The vendor adds their license under Settings → Medical license
          {vendorStatus === 'pending_approval' ? ' — they stay in review until you approve it here.' : '.'}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
            <PayoutStat label="License #" value={license.number ?? '—'} />
            <PayoutStat label="State" value={license.state ?? '—'} />
            <PayoutStat label="Type" value={license.type ?? '—'} />
            {license.submittedAt ? (
              <PayoutStat label="Submitted" value={new Date(license.submittedAt).toLocaleDateString()} />
            ) : null}
          </div>

          {license.hasDocument ? (
            <button
              onClick={openDocument}
              disabled={docUrl.isPending}
              style={{
                fontSize: 14, fontWeight: 700, color: 'var(--brand-600)',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              {docUrl.isPending ? 'Opening…' : 'View license document ↗'}
            </button>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No document attached.</span>
          )}

          {license.status === 'rejected' && license.rejectionReason ? (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              Rejected{license.reviewedAt ? ` ${new Date(license.reviewedAt).toLocaleDateString()}` : ''}: “{license.rejectionReason}”
            </div>
          ) : null}

          {license.status === 'pending_review' ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              {!rejecting ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => review.mutate({ vendorId, decision: 'approve' })}
                    disabled={review.isPending}
                    style={{
                      padding: '9px 16px', fontSize: 14, fontWeight: 700, borderRadius: 999,
                      border: '1px solid var(--success)', background: 'var(--success)', color: '#fff',
                    }}
                  >
                    {review.isPending ? '…' : vendorStatus === 'pending_approval' ? 'Approve — take them live' : 'Approve license'}
                  </button>
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={review.isPending}
                    style={{
                      padding: '9px 16px', fontSize: 14, fontWeight: 700, borderRadius: 999,
                      border: '1px solid var(--error)', background: 'var(--surface-elevated)', color: 'var(--error)',
                    }}
                  >
                    Reject…
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Why it can't be verified — the vendor sees this verbatim. e.g. “Number doesn't match the TX board lookup — double-check and resubmit.”"
                    style={{
                      padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
                      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-default)', color: 'var(--text-primary)', resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setRejecting(false); setReason(''); }}
                      disabled={review.isPending}
                      style={{
                        padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999,
                        border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => review.mutate({ vendorId, decision: 'reject', reason: reason.trim() || null })}
                      disabled={review.isPending || reason.trim().length < 5}
                      style={{
                        padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
                        border: '1px solid var(--error)', background: 'var(--error)', color: '#fff',
                        opacity: review.isPending || reason.trim().length < 5 ? 0.5 : 1,
                      }}
                    >
                      {review.isPending ? '…' : 'Reject license'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function ReleaseHistory({ releases }: { releases: Release[] }) {
  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Release history</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 14 }}>
        Every transfer that's fired from the Gloe platform balance to their Connect account.
      </p>
      {releases.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>No releases yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {releases.map((r, i) => (
            <div
              key={r.transactionId}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 0',
                borderBottom: i === releases.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {r.dealTitle ?? 'Untitled deal'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                  <span>{new Date(r.releasedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span>·</span>
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.transactionDisplayId}</span>
                  {r.customerEmail ? <><span>·</span><span>{r.customerEmail}</span></> : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Stripe transfer:{' '}
                  <a
                    href={`https://dashboard.stripe.com/test/connect/transfers/${r.stripeTransferId}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--brand-600)', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.15)' }}
                  >
                    {r.stripeTransferId}
                  </a>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {money(r.amountCents)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
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

function PnlRow({ label, value, subtle, bold }: { label: string; value: string; subtle?: boolean; bold?: boolean }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: bold ? 16 : 14,
        color: subtle ? 'var(--text-secondary)' : 'var(--text-primary)',
        fontWeight: bold ? 700 : 500,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{value}</span>
    </div>
  );
}

/** Uppercase group header that turns the card stack into named sections. */
function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '2px 0 -8px', ...style }}>
      {children}
    </div>
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

/**
 * God-mode quick-edit modal. Fetches the deal's current title/description/
 * fine print/expiry, lets admin tweak in place. Hits admin.quickEditDeal —
 * preserves status (no bounce-to-pending_review) and audit-logs the change.
 */
function DealQuickEditModal({
  dealId, onClose, onSaved,
}: {
  dealId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = trpc.admin.dealDetail.useQuery({ dealId });
  const save = trpc.admin.quickEditDeal.useMutation();
  const d = detail.data;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [finePrint, setFinePrint] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Prefill once the data lands.
  useEffect(() => {
    if (!d) return;
    setTitle(d.title);
    setDescription(d.description);
    setFinePrint(d.finePrint ?? '');
    setPhotos(d.photoUrls);
    // <input type="datetime-local"> expects YYYY-MM-DDTHH:mm — slice off TZ + seconds.
    setExpiresAt(new Date(d.expiresAt).toISOString().slice(0, 16));
  }, [d]);

  const submit = async () => {
    setError(null);
    if (photos.length === 0) {
      setError('A deal needs at least one photo. Add one before saving.');
      return;
    }
    try {
      await save.mutateAsync({
        dealId,
        title,
        description,
        finePrint: finePrint.trim() === '' ? null : finePrint,
        expiresAt: new Date(expiresAt).toISOString(),
        photoUrls: photos,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 22,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div>
          <h2 style={{ fontSize: 19 }}>Quick edit deal</h2>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Edits stay live without re-review. Audit-logged. For variant / video changes, route the vendor to edit it themselves.
          </div>
        </div>

        {!d ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                style={modalInput}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={5}
                style={{ ...modalInput, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>

            <Field label="Fine print (optional)">
              <textarea
                value={finePrint}
                onChange={(e) => setFinePrint(e.target.value)}
                maxLength={2000}
                rows={3}
                style={{ ...modalInput, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>

            <Field label="Expires at">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                style={modalInput}
              />
            </Field>

            {/* asLabel={false}: the uploader has its own buttons/inputs, so a
                wrapping <label> would forward stray clicks to a control and
                silently delete photos. Render as a plain group instead. */}
            <Field label="Photos" asLabel={false}>
              <PhotoUploader urls={photos} onChange={setPhotos} />
            </Field>

            {error ? (
              <div style={{ fontSize: 12, color: 'var(--error)', padding: '8px 10px', background: 'rgba(218,79,71,0.08)', borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={save.isPending}
                style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--border-subtle)', background: 'transparent', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={save.isPending}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: '#fff', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
              >
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  asLabel = true,
}: {
  label: string;
  children: React.ReactNode;
  // A <label> forwards clicks to its associated control. That's right for a
  // single input, but wrong for composite widgets (e.g. PhotoUploader) where a
  // stray click in blank space would trigger a button inside. Pass asLabel={false}
  // for those to render a plain <div> with a non-label heading.
  asLabel?: boolean;
}) {
  const heading = (
    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{label}</span>
  );
  const style = { display: 'flex', flexDirection: 'column', gap: 4 } as const;
  if (!asLabel) {
    return <div style={style}>{heading}{children}</div>;
  }
  return (
    <label style={style}>
      {heading}
      {children}
    </label>
  );
}

const modalInput: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};

/**
 * Admin editor for "Gloē's take" — the editorial note + perk chips on a spa.
 * Per-vendor, so it shows on every deal for this business + the spa storefront.
 */
function GloeTakeEditor({
  vendorId, initialTake, initialPerks, onSaved,
}: {
  vendorId: string;
  initialTake: string | null;
  initialPerks: string[];
  onSaved: () => void;
}) {
  const save = trpc.admin.setVendorTake.useMutation();
  const [take, setTake] = useState(initialTake ?? '');
  const [perks, setPerks] = useState<string[]>(initialPerks);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  const addPerk = () => {
    const p = draft.trim();
    if (!p || perks.includes(p) || perks.length >= 6) { setDraft(''); return; }
    setPerks([...perks, p]);
    setDraft('');
  };
  const submit = async () => {
    await save.mutateAsync({ vendorId, take: take.trim() === '' ? null : take, perks });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    onSaved();
  };

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>Gloē&rsquo;s take</h2>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>
        Editorial note in Gloē&rsquo;s voice + quick &ldquo;good to know&rdquo; perks. Shows on every deal for this spa.
      </p>
      <textarea
        value={take}
        onChange={(e) => setTake(e.target.value)}
        maxLength={600}
        rows={4}
        placeholder="e.g. Chic, sunlit space with the warmest front desk in town — grab a flat white next door at Blue Bottle before your appointment."
        style={{ ...modalInput, width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
      />
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Perks ({perks.length}/6)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {perks.map((p) => (
            <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--brand-50)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '5px 10px', fontSize: 13 }}>
              {p}
              <button type="button" onClick={() => setPerks(perks.filter((x) => x !== p))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPerk(); } }}
            maxLength={60}
            placeholder="Add a perk (e.g. Free parking) — press Enter"
            disabled={perks.length >= 6}
            style={{ ...modalInput, flex: 1 }}
          />
          <Button onClick={addPerk} disabled={perks.length >= 6}>Add</Button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save take'}</Button>
        {saved ? <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Saved ✓</span> : null}
      </div>
    </Card>
  );
}

/**
 * Admin-curated profile videos for a spa — load clips on their behalf at
 * onboarding. Same reel the vendor can manage themselves; persists immediately.
 */
function VendorVideosCard({ vendorId }: { vendorId: string }) {
  const utils = trpc.useUtils();
  const videosQ = trpc.admin.listVendorVideos.useQuery({ vendorId });
  const sign = trpc.admin.signVendorUpload.useMutation();
  const add = trpc.admin.addVendorVideo.useMutation();
  const del = trpc.admin.deleteVendorVideo.useMutation();

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>Profile videos</h2>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>
        Clips for the &ldquo;Inside the spa&rdquo; reel on their storefront. Upload on their behalf at signup — the
        vendor can manage these too from their own dashboard.
      </p>
      <VendorVideosManager
        videos={videosQ.data ?? []}
        busy={videosQ.isLoading}
        sign={(args) => sign.mutateAsync({ vendorId, ...args })}
        onAdd={async (draft) => {
          await add.mutateAsync({ vendorId, ...draft });
          await utils.admin.listVendorVideos.invalidate({ vendorId });
        }}
        onDelete={async (id) => {
          await del.mutateAsync({ vendorId, videoId: id });
          await utils.admin.listVendorVideos.invalidate({ vendorId });
        }}
      />
    </Card>
  );
}

/**
 * One-click Google linking: resolves the vendor's place_id from its name +
 * address (Find Place from Text) and stores it, so Google reviews auto-populate.
 */
function GoogleLinkButton({ vendorId, linked }: { vendorId: string; linked: boolean }) {
  const utils = trpc.useUtils();
  const [msg, setMsg] = useState<string | null>(null);
  const link = trpc.admin.linkGooglePlace.useMutation({
    onSuccess: (r) => {
      setMsg(r.linked ? 'Linked ✓ — reviews load on next view' : 'No Google match found — check the address');
      void utils.admin.vendorDetail.invalidate({ vendorId });
    },
    onError: (e) => setMsg(e.message),
  });
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => { setMsg(null); link.mutate({ vendorId }); }}
        disabled={link.isPending}
        style={{
          fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          border: '1px solid var(--brand-500)', background: 'var(--surface-elevated)', color: 'var(--brand-600)', cursor: 'pointer',
        }}
      >
        {link.isPending ? 'Linking…' : linked ? 'Re-link Google' : 'Link Google reviews'}
      </button>
      {msg ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{msg}</span> : null}
    </span>
  );
}

function Tag({ ok, label }: { ok: boolean | null; label: string }) {
  const c = ok === null ? 'var(--text-tertiary)' : ok ? 'var(--success)' : 'var(--accent-500)';
  const b = ok === null ? 'var(--surface-secondary)' : ok ? 'rgba(122,139,92,0.12)' : 'rgba(178,93,64,0.12)';
  return <span style={{ fontSize: 12, fontWeight: 700, color: c, background: b, padding: '4px 10px', borderRadius: 999 }}>{label}</span>;
}
