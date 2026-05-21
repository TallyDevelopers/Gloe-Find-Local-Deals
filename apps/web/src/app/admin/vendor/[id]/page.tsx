'use client';

import { UserButton } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';

import { Button, Card } from '../../../../components/ui';
import { Wordmark } from '../../../../components/Wordmark';
import { trpc } from '../../../../lib/trpc';

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
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <PayoutStat label="Paid out" value={money(data.vendor.payoutPaidCents)} />
                  <PayoutStat label="Pending / in transit" value={money(data.vendor.payoutPendingCents)} />
                  <PayoutStat label="Failed payouts" value={String(data.vendor.payoutFailedCount)} alert={data.vendor.payoutFailedCount > 0} />
                </div>
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
