'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card } from '../../components/ui';
import { trpc } from '../../lib/trpc';
import { DealPreview } from '../vendor/post/DealPreview';

type View = 'overview' | 'vendors' | 'money' | 'activity' | 'pending';

const NAV: { key: View; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '◆' },
  { key: 'money', label: 'Money', icon: '$' },
  { key: 'vendors', label: 'Vendors', icon: '▣' },
  { key: 'pending', label: 'Pending', icon: '◷' },
  { key: 'activity', label: 'Activity', icon: '◐' },
];

export function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function AdminDashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>('overview');
  const pendingCount = trpc.admin.pendingDeals.useQuery().data?.length ?? 0;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map((n) => {
            const active = view === n.key;
            const badge = n.key === 'pending' && pendingCount > 0 ? pendingCount : null;
            return (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 'var(--radius-md)',
                  border: 'none', textAlign: 'left', fontSize: 15, fontWeight: 600,
                  background: active ? 'var(--brand-500)' : 'transparent',
                  color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
                }}
              >
                <span style={{ width: 18, textAlign: 'center', opacity: 0.9 }}>{n.icon}</span>
                {n.label}
                {badge ? (
                  <span style={{ marginLeft: 'auto', background: active ? 'rgba(255,255,255,0.25)' : 'var(--accent-500)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 7px' }}>{badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <Button onClick={() => router.push('/admin/add-spa')} style={{ width: '100%' }}>+ Add a spa</Button>
        </div>
      </aside>

      <section className="admin-main">
        {view === 'overview' ? <OverviewView onSeeAll={setView} /> : null}
        {view === 'money' ? <MoneyView /> : null}
        {view === 'vendors' ? <VendorsView /> : null}
        {view === 'pending' ? <PendingView /> : null}
        {view === 'activity' ? <ActivityView /> : null}
      </section>
    </div>
  );
}

function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 30 }}>{title}</h1>
      {sub ? <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 2 }}>{sub}</p> : null}
    </div>
  );
}

/* ---------- Overview: the pulse ---------- */
function OverviewView({ onSeeAll }: { onSeeAll: (v: View) => void }) {
  const overview = trpc.admin.overview.useQuery();
  const top = trpc.admin.topVendors.useQuery();
  const activity = trpc.admin.recentActivity.useQuery();
  const d = overview.data;

  return (
    <>
      <PageTitle title="Overview" sub="Everything across Gloē, at a glance." />
      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <StatCard label="My income (all time)" value={d ? money(d.incomeCents) : '—'} hero />
        <StatCard label="Income · 30 days" value={d ? money(d.income30dCents) : '—'} />
        <StatCard label="Gross volume" value={d ? money(d.grossCents) : '—'} />
      </div>
      <div className="admin-two-col">
        <Card>
          <SectionHead title="Top vendors" onSeeAll={() => onSeeAll('money')} />
          <VendorRows rows={(top.data ?? []).slice(0, 3)} />
        </Card>
        <Card>
          <SectionHead title="Latest activity" onSeeAll={() => onSeeAll('activity')} />
          <ActivityRows rows={(activity.data ?? []).slice(0, 5)} />
        </Card>
      </div>
    </>
  );
}

/* ---------- Money: the deep view ---------- */
function MoneyView() {
  const overview = trpc.admin.overview.useQuery();
  const top = trpc.admin.topVendors.useQuery();
  const d = overview.data;
  return (
    <>
      <PageTitle title="Money" sub="Your income and where it comes from." />
      <div className="admin-stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="My income (all time)" value={d ? money(d.incomeCents) : '—'} hero />
        <StatCard label="Income · 30 days" value={d ? money(d.income30dCents) : '—'} />
        <StatCard label="Gross volume" value={d ? money(d.grossCents) : '—'} />
        <StatCard label="Vendor payouts" value={d ? money(d.payoutCents) : '—'} />
        <StatCard label="Purchases" value={d ? String(d.txnCount) : '—'} />
        <StatCard label="Active deals" value={d ? String(d.activeDealCount) : '—'} />
      </div>
      <Card>
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>Top vendors by revenue</h2>
        <VendorRows rows={top.data ?? []} />
      </Card>
    </>
  );
}

/* ---------- Vendors: management ---------- */
function VendorsView() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const q = trpc.admin.vendorRoster.useQuery();
  const setOverride = trpc.admin.setVendorOverride.useMutation({
    onSuccess: () => utils.admin.vendorRoster.invalidate(),
  });
  const rows = q.data ?? [];

  return (
    <>
      <div className="dash-header" style={{ marginBottom: 24 }}>
        <PageTitle title="Vendors" sub={`${rows.length} spas on the platform.`} />
        <Button onClick={() => router.push('/admin/add-spa')}>+ Add a spa</Button>
      </div>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((v, i) => {
            const stripeOk = v.stripeStatus === 'active';
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                <div
                  onClick={() => router.push(`/admin/vendor/${v.id}`)}
                  style={{ flex: 1, minWidth: 180, cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--brand-600)' }}>{v.businessName} →</div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    {v.city} · {v.dealCount} deals · {v.purchases} buys · {money(v.grossCents)} gross
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Tag ok={v.hasOwner ? true : null} label={v.hasOwner ? 'claimed' : 'unclaimed'} />
                  <Tag ok={stripeOk} label={stripeOk ? 'stripe' : 'no payout'} />
                  <Tag ok={v.hasLicense} label={v.hasLicense ? 'licensed' : 'no license'} />
                  <button
                    onClick={() => setOverride.mutate({ vendorId: v.id, bypassRequirements: true })}
                    disabled={setOverride.isPending}
                    title="Let this vendor post without license/Stripe"
                    style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 999, border: '1px solid var(--brand-500)', background: 'var(--surface-elevated)', color: 'var(--brand-600)' }}
                  >
                    Open gates
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

/* ---------- Pending: review queue with expand + reject message ---------- */
function PendingView() {
  const utils = trpc.useUtils();
  const q = trpc.admin.pendingDeals.useQuery();
  const review = trpc.admin.reviewDeal.useMutation({
    onSuccess: () => {
      void utils.admin.pendingDeals.invalidate();
      void utils.admin.vendorRoster.invalidate();
    },
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const rows = q.data ?? [];

  const submitReject = (dealId: string) => {
    review.mutate({ dealId, decision: 'reject', reason: reason.trim() || null });
    setRejecting(null);
    setReason('');
    setExpanded(null);
  };

  return (
    <>
      <PageTitle title="Pending review" sub={`${rows.length} ${rows.length === 1 ? 'deal' : 'deals'} waiting for approval.`} />
      {rows.length === 0 ? (
        <Card><p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>Nothing waiting. All caught up. ✓</p></Card>
      ) : (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((d, i) => {
              const open = expanded === d.id;
              return (
                <div key={d.id} style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)', paddingBottom: open ? 8 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setExpanded(open ? null : d.id)}
                      style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--text-tertiary)', width: 18 }}
                      title={open ? 'Collapse' : 'Expand'}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                    <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', flexShrink: 0, background: d.primaryPhotoUrl ? `center/cover url(${d.primaryPhotoUrl})` : 'var(--surface-secondary)' }} />
                    <div style={{ flex: 1, minWidth: 160, cursor: 'pointer' }} onClick={() => setExpanded(open ? null : d.id)}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{d.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                        {d.businessName} · {d.categoryName}{d.minPriceCents != null ? ` · ${money(d.minPriceCents)}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { setRejecting(d.id); setExpanded(d.id); setReason(''); }}
                        disabled={review.isPending}
                        style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999, border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => review.mutate({ dealId: d.id, decision: 'approve' })}
                        disabled={review.isPending}
                        style={{ padding: '7px 16px', fontSize: 13, fontWeight: 700, borderRadius: 999, border: 'none', background: 'var(--success)', color: '#fff' }}
                      >
                        Approve
                      </button>
                    </div>
                  </div>

                  {open ? <ExpandedDeal dealId={d.id} /> : null}

                  {rejecting === d.id ? (
                    <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Tell them why — this shows on their dashboard</div>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="e.g. Please add a clear before/after photo and confirm the unit pricing."
                        style={{ fontFamily: 'var(--font-body)', fontSize: 14, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', resize: 'vertical', background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setRejecting(null); setReason(''); }} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999, border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)' }}>Cancel</button>
                        <button onClick={() => submitReject(d.id)} disabled={review.isPending} style={{ padding: '7px 16px', fontSize: 13, fontWeight: 700, borderRadius: 999, border: 'none', background: 'var(--error)', color: '#fff' }}>
                          Send rejection
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

function ExpandedDeal({ dealId }: { dealId: string }) {
  const q = trpc.admin.dealDetail.useQuery({ dealId });
  const d = q.data;
  if (!d) return <div style={{ padding: '0 0 12px 32px', color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>;

  // Map admin deal detail into the exact same preview the vendor sees on iPhone.
  const previewData = {
    categoryLabel: d.categoryName,
    subtypeLabel: d.subtypeName,
    title: d.title,
    description: d.description,
    whatsIncluded: d.whatsIncluded,
    restrictions: d.restrictions,
    photoUrls: d.photoUrls,
    videos: d.videos,
    variants: d.variants.map((v) => ({
      label: v.label,
      unitCount: v.unitCount != null ? String(v.unitCount) : '',
      originalPrice: (v.originalPriceCents / 100).toString(),
      dealPrice: (v.dealPriceCents / 100).toString(),
      spotsTotal: v.spotsTotal != null ? String(v.spotsTotal) : '',
    })),
    vendorName: d.vendorName,
    amenities: d.vendorAmenities,
    redemption: {
      address: d.redemptionAddress,
      lat: d.redemptionLat ?? d.vendorLat,
      lng: d.redemptionLng ?? d.vendorLng,
    },
  };

  return (
    <div style={{ padding: '4px 0 20px 32px', display: 'flex', justifyContent: 'center' }}>
      <DealPreview data={previewData} />
    </div>
  );
}

/* ---------- Activity: full feed ---------- */
function ActivityView() {
  const q = trpc.admin.recentActivity.useQuery();
  return (
    <>
      <PageTitle title="Activity" sub="Every purchase, newest first." />
      <Card>
        <ActivityRows rows={q.data ?? []} />
      </Card>
    </>
  );
}

/* ---------- shared bits ---------- */
function StatCard({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <Card style={hero ? { background: 'var(--brand-50)', border: '1px solid var(--brand-100)' } : undefined}>
      <div style={{ fontSize: hero ? 38 : 26, fontWeight: 700, fontFamily: 'var(--font-display)', color: hero ? 'var(--brand-600)' : 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{label}</div>
    </Card>
  );
}

function SectionHead({ title, onSeeAll }: { title: string; onSeeAll: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <h2 style={{ fontSize: 19 }}>{title}</h2>
      <button onClick={onSeeAll} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: 13, fontWeight: 600 }}>See all →</button>
    </div>
  );
}

type TopVendor = { vendorId: string; businessName: string; purchases: number; grossCents: number; incomeCents: number };
function VendorRows({ rows }: { rows: TopVendor[] }) {
  if (rows.length === 0) return <p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>No sales yet.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((v, i) => (
        <div key={v.vendorId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
          <div style={{ width: 24, fontWeight: 700, color: 'var(--text-tertiary)' }}>{i + 1}</div>
          <div style={{ flex: 1, fontWeight: 600 }}>{v.businessName}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, width: 70 }}>{v.purchases} buys</div>
          <div style={{ color: 'var(--brand-600)', fontWeight: 700, fontSize: 14, width: 90, textAlign: 'right' }}>{money(v.incomeCents)} me</div>
        </div>
      ))}
    </div>
  );
}

type Activity = { id: string; businessName: string; consumerPaidCents: number; platformFeeCents: number; buyer: string | null; paidAt: string | null };
function ActivityRows({ rows }: { rows: Activity[] }) {
  if (rows.length === 0) return <p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>No purchases yet.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((a, i) => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
          <div style={{ flex: 1, fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>{a.buyer ?? 'Someone'}</span>
            <span style={{ color: 'var(--text-secondary)' }}> · </span>
            <span style={{ fontWeight: 600 }}>{a.businessName}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{money(a.consumerPaidCents)}</div>
          <div style={{ color: 'var(--brand-600)', fontWeight: 700, fontSize: 13, width: 64, textAlign: 'right' }}>+{money(a.platformFeeCents)}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 12, width: 80, textAlign: 'right' }}>{timeAgo(a.paidAt)}</div>
        </div>
      ))}
    </div>
  );
}

function Tag({ ok, label }: { ok: boolean | null; label: string }) {
  const c = ok === null ? 'var(--text-tertiary)' : ok ? 'var(--success)' : 'var(--accent-500)';
  const b = ok === null ? 'var(--surface-secondary)' : ok ? 'rgba(122,139,92,0.12)' : 'rgba(178,93,64,0.12)';
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: b, padding: '3px 8px', borderRadius: 999 }}>{label}</span>;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400_000);
  if (d >= 1) return `${d}d ago`;
  const h = Math.floor(ms / 3600_000);
  if (h >= 1) return `${h}h ago`;
  const m = Math.floor(ms / 60_000);
  return m >= 1 ? `${m}m ago` : 'just now';
}
