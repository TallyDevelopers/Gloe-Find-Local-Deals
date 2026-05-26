'use client';

import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { Button, Card } from '../../components/ui';
import { Wordmark } from '../../components/Wordmark';
import { trpc } from '../../lib/trpc';
import { ScanTab } from './ScanTab';

interface VendorDashboardProps {
  vendor: { id: string; businessName: string; slug: string; status: string };
}

type SetupData = RouterOutputs['vendor']['setupStatus'] | undefined;
type HubSnapshot = RouterOutputs['vendor']['hubSnapshot'];
type Voucher = RouterOutputs['vendor']['vouchers'][number];
type VendorDeal = RouterOutputs['vendor']['listDeals'][number];

interface StepDef {
  key: 'license' | 'stripe' | 'provider' | 'photos';
  label: string;
  required: boolean;
}

const STEPS: StepDef[] = [
  { key: 'license', label: 'Medical license & verification', required: true },
  { key: 'stripe', label: 'Connect bank for payouts', required: true },
  { key: 'provider', label: 'Add a provider', required: false },
  { key: 'photos', label: 'Practice photos', required: false },
];

type Tab = 'hub' | 'scan' | 'deals' | 'settings';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function moneyDetail(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function VendorDashboard({ vendor }: VendorDashboardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const setupQuery = trpc.vendor.setupStatus.useQuery();
  const setup = setupQuery.data;
  const [tab, setTab] = useState<Tab>('hub');

  // Sweep any elapsed deals to 'expired' on load so lists stay accurate.
  const sweep = trpc.vendor.sweepExpired.useMutation();
  useEffect(() => {
    sweep.mutateAsync().then((r) => {
      if (r.expired > 0) {
        void utils.vendor.listDeals.invalidate();
        void utils.vendor.hubSnapshot.invalidate();
        void utils.vendor.vouchers.invalidate();
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-elevated)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Wordmark size={22} tone="gold" />
            <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              FOR BUSINESS
            </span>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="page-main" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 20 }}>
        {tab === 'hub' ? (
          <HubTab vendor={vendor} setup={setup} onPost={() => router.push('/vendor/post')} />
        ) : null}
        {tab === 'scan' ? <ScanTab canScan={setup?.canPostDeals ?? false} /> : null}
        {tab === 'deals' ? <DealsTab onPost={() => router.push('/vendor/post')} /> : null}
        {tab === 'settings' ? <SettingsTab setup={setup} /> : null}
      </main>

      <BottomTabs tab={tab} setTab={setTab} />
    </div>
  );
}

/* ---------- HUB TAB ---------- */

function HubTab({
  vendor,
  setup,
  onPost,
}: {
  vendor: VendorDashboardProps['vendor'];
  setup: SetupData;
  onPost: () => void;
}) {
  const snap = trpc.vendor.hubSnapshot.useQuery();
  const stripeMoney = trpc.vendor.stripeMoney.useQuery();
  const canPost = setup?.canPostDeals ?? false;

  return (
    <>
      <HubHeader
        vendor={vendor}
        canPost={canPost}
        onPost={canPost ? onPost : undefined}
      />
      {!canPost ? <SetupBanner setup={setup} /> : null}
      <TodayCard data={snap.data} loading={snap.isLoading} />
      <MoneyCard
        snap={snap.data}
        loading={snap.isLoading}
        stripeAvailableCents={stripeMoney.data?.availableCents ?? null}
        stripePendingCents={stripeMoney.data?.pendingCents ?? null}
        stripeLoading={stripeMoney.isLoading}
      />
      <VouchersCard />
      <ProfileEditorCard />
    </>
  );
}

function HubHeader({
  vendor,
  canPost,
  onPost,
}: {
  vendor: VendorDashboardProps['vendor'];
  canPost: boolean;
  onPost?: () => void;
}) {
  const pill = (() => {
    if (vendor.status === 'suspended') return { label: 'Suspended', color: 'var(--error)' };
    if (vendor.status === 'paused')    return { label: 'Paused',    color: 'var(--text-tertiary)' };
    if (vendor.status === 'pending_approval') return { label: 'In review', color: 'var(--brand-500)' };
    if (canPost) return { label: 'Active', color: 'var(--success)' };
    return { label: 'Setup', color: 'var(--accent-500)' };
  })();

  return (
    <div className="dash-header">
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 28, lineHeight: 1.2 }}>{vendor.businessName}</h1>
        <span
          style={{
            display: 'inline-block',
            marginTop: 4,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: pill.color,
          }}
        >
          ● {pill.label.toUpperCase()}
        </span>
      </div>
      {canPost && onPost ? <Button onClick={onPost}>+ Post a deal</Button> : null}
    </div>
  );
}

function SetupBanner({ setup }: { setup: SetupData }) {
  const stepsLeft = setup
    ? STEPS.filter((s) => s.required && !setup.steps[s.key]).length
    : 0;
  return (
    <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-100)' }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
        {stepsLeft > 0
          ? `Finish ${stepsLeft} step${stepsLeft === 1 ? '' : 's'} to start posting deals.`
          : "You're approved — just a couple steps left."}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
        Open <strong>Settings</strong> to connect Stripe, add your license, and finish setup.
      </div>
    </Card>
  );
}

function TodayCard({ data, loading }: { data: HubSnapshot | undefined; loading: boolean }) {
  if (loading || !data) {
    return (
      <Card>
        <CardTitle>Today</CardTitle>
        <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      </Card>
    );
  }
  return (
    <Card>
      <CardTitle>Today</CardTitle>
      <div className="stat-grid" style={{ marginTop: 4 }}>
        <BigStat
          value={money(data.soldToday.cents)}
          label={`Sold today · ${data.soldToday.count} sale${data.soldToday.count === 1 ? '' : 's'}`}
          hero
        />
        <BigStat
          value={String(data.redeemedToday)}
          label="Redeemed today"
        />
        <BigStat
          value={String(data.activeVouchers.count)}
          label={
            data.activeVouchers.nextExpiresAt
              ? `Active vouchers · next ${shortDate(data.activeVouchers.nextExpiresAt)}`
              : 'Active vouchers'
          }
        />
      </div>
    </Card>
  );
}

function MoneyCard({
  snap,
  loading,
  stripeAvailableCents,
  stripePendingCents,
  stripeLoading,
}: {
  snap: HubSnapshot | undefined;
  loading: boolean;
  stripeAvailableCents: number | null;
  stripePendingCents: number | null;
  stripeLoading: boolean;
}) {
  const dashboard = trpc.vendor.stripeDashboardLink.useMutation({
    onSuccess: ({ url }) => window.open(url, '_blank'),
  });

  return (
    <Card>
      <CardTitle>Money</CardTitle>

      <div className="stat-grid" style={{ marginTop: 4 }}>
        <MoneyStat
          label="In your Stripe account"
          value={stripeAvailableCents == null ? (stripeLoading ? '…' : '—') : moneyDetail(stripeAvailableCents)}
          sub={
            stripePendingCents != null && stripePendingCents > 0
              ? `+ ${moneyDetail(stripePendingCents)} pending`
              : undefined
          }
          hero
        />
        <MoneyStat
          label="Queued for transfer"
          value={loading || !snap ? '…' : moneyDetail(snap.held.cents)}
          sub={!loading && snap ? `${snap.held.count} voucher${snap.held.count === 1 ? '' : 's'}` : undefined}
        />
        <MoneyStat
          label="Paid out · last 7d"
          value={loading || !snap ? '…' : moneyDetail(snap.paid7dCents)}
          sub={!loading && snap && snap.inTransitCents > 0 ? `+ ${moneyDetail(snap.inTransitCents)} in transit` : undefined}
        />
      </div>

      <InstantPayoutInline />

      {snap && snap.failedPayoutCount > 0 ? (
        <div
          style={{
            marginTop: 14,
            padding: '12px 16px',
            background: 'rgba(178,69,69,0.08)',
            border: '1px solid rgba(178,69,69,0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--error)' }}>
              {snap.failedPayoutCount} payout{snap.failedPayoutCount === 1 ? '' : 's'} failed to reach your bank
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Usually a wrong routing number or a closed account. Open your Stripe dashboard to fix it.
            </div>
          </div>
          <button
            onClick={() => dashboard.mutate()}
            disabled={dashboard.isPending}
            style={pillButton('error')}
          >
            {dashboard.isPending ? '…' : 'Open Stripe'}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

function InstantPayoutInline() {
  const utils = trpc.useUtils();
  const statusQ = trpc.vendor.instantPayoutStatus.useQuery();
  const [confirming, setConfirming] = useState(false);
  const request = trpc.vendor.requestInstantPayout.useMutation({
    onSuccess: () => {
      setConfirming(false);
      void utils.vendor.stripeMoney.invalidate();
      void utils.vendor.hubSnapshot.invalidate();
      void utils.vendor.instantPayoutStatus.invalidate();
    },
  });

  if (!statusQ.data) return null;
  const { optedIn, eligible, availableCents, feePercent } = statusQ.data;
  if (!optedIn) return null;
  if (availableCents <= 0) return null;

  const fee = Math.round(availableCents * (feePercent / 100));
  const net = availableCents - fee;

  return (
    <div
      style={{
        marginTop: 14,
        padding: '14px 16px',
        background: 'var(--brand-50)',
        border: '1px solid var(--brand-100)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {!confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Pay yourself now — {moneyDetail(availableCents)} available
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {feePercent}% fee · arrives on your debit card in ~30 min
            </div>
          </div>
          <button
            onClick={() => setConfirming(true)}
            disabled={!eligible}
            style={pillButton('brand')}
          >
            Pay me now
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            Confirm instant payout
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Payout amount</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{moneyDetail(availableCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Fee ({feePercent}%)</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>− {moneyDetail(fee)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              padding: '8px 0',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: 6,
            }}
          >
            <span style={{ fontWeight: 700 }}>You receive</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-600)', fontVariantNumeric: 'tabular-nums' }}>
              {moneyDetail(net)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setConfirming(false)}
              disabled={request.isPending}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                minHeight: 36,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => request.mutate({ amountCents: availableCents })}
              disabled={request.isPending}
              style={pillButton('brand')}
            >
              {request.isPending ? 'Sending…' : 'Confirm payout'}
            </button>
          </div>
          {request.error ? (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>
              {request.error.message}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ---------- Profile editor: fills the storefront with real content ---------- */

function ProfileEditorCard() {
  const profile = trpc.vendor.myProfile.useQuery();
  const update = trpc.vendor.updateProfile.useMutation();
  const utils = trpc.useUtils();

  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [hoursSummary, setHoursSummary] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Prefill once when data lands; don't trample the user's typing on refetch.
  useEffect(() => {
    if (!profile.data || hydrated) return;
    setDescription(profile.data.description);
    setWebsite(profile.data.website);
    setInstagramHandle(profile.data.instagramHandle);
    setHoursSummary(profile.data.hoursSummary);
    setHydrated(true);
  }, [profile.data, hydrated]);

  const completeness = (() => {
    if (!profile.data) return 0;
    let n = 0;
    if (description.trim().length > 20) n++;
    if (website.trim().length > 0) n++;
    if (instagramHandle.trim().length > 0) n++;
    if (hoursSummary.trim().length > 0) n++;
    return n;
  })();

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        description: description.trim() || null,
        website: website.trim() || null,
        instagramHandle: instagramHandle.trim() || null,
        hoursSummary: hoursSummary.trim() || null,
      });
      setSavedAt(Date.now());
      await utils.vendor.myProfile.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <CardTitle>Your storefront</CardTitle>
        <div style={{ fontSize: 12, color: completeness === 4 ? 'var(--success)' : 'var(--text-tertiary)' }}>
          {completeness === 4 ? '✓ Complete' : `${completeness}/4 fields filled`}
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 14 }}>
        This is what customers see when they tap into your spa from a deal or voucher.
        Filling it out helps customers trust you and book again.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ProfileField label="About your spa" hint="A short paragraph. What's special? Who's it for?">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Locally owned med spa specializing in injectables and laser…"
            style={profileInput}
          />
        </ProfileField>

        <ProfileField label="Hours" hint="Free-text — e.g. Mon-Fri 9-7, Sat 10-4, Sun closed">
          <input
            value={hoursSummary}
            onChange={(e) => setHoursSummary(e.target.value)}
            maxLength={280}
            placeholder="Mon-Fri 9-7, Sat 10-4"
            style={profileInput}
          />
        </ProfileField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <ProfileField label="Website">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={500}
              placeholder="https://yourspa.com"
              style={profileInput}
            />
          </ProfileField>
          <ProfileField label="Instagram handle">
            <input
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              maxLength={60}
              placeholder="@yourspa"
              style={profileInput}
            />
          </ProfileField>
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: 'var(--error)' }}>{error}</div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {savedAt && Date.now() - savedAt < 5000 ? (
            <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Saved</span>
          ) : null}
          <button
            onClick={save}
            disabled={update.isPending}
            style={{
              padding: '10px 18px',
              fontSize: 14, fontWeight: 700,
              background: 'var(--brand-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Card>
  );
}

function ProfileField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      {children}
      {hint ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{hint}</span> : null}
    </label>
  );
}

const profileInput: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
  resize: 'vertical',
};

/* ---------- Vouchers card with tabs ---------- */

function VouchersCard() {
  const [tab, setTab] = useState<'active' | 'redeemed' | 'past'>('active');
  const q = trpc.vendor.vouchers.useQuery({ tab });
  const rows = q.data ?? [];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <CardTitle>Vouchers</CardTitle>
        <div style={{ display: 'flex', gap: 6, fontSize: 13 }}>
          <TabChip on={tab === 'active'}   onClick={() => setTab('active')}>Active</TabChip>
          <TabChip on={tab === 'redeemed'} onClick={() => setTab('redeemed')}>Redeemed</TabChip>
          <TabChip on={tab === 'past'}     onClick={() => setTab('past')}>Past</TabChip>
        </div>
      </div>
      {q.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
          {tab === 'active' && 'No active vouchers right now.'}
          {tab === 'redeemed' && 'No redemptions yet.'}
          {tab === 'past' && 'Nothing here.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((v, i) => (
            <VoucherRow key={v.claimId} v={v} last={i === rows.length - 1} tab={tab} />
          ))}
        </div>
      )}
    </Card>
  );
}

function VoucherRow({ v, last, tab }: { v: Voucher; last: boolean; tab: 'active' | 'redeemed' | 'past' }) {
  const sub = (() => {
    if (tab === 'active') return v.expiresAt ? `Expires ${shortDate(v.expiresAt)} · code ${v.humanCode}` : `Code ${v.humanCode}`;
    if (tab === 'redeemed') return v.redeemedAt ? `Redeemed ${shortDate(v.redeemedAt)}` : 'Redeemed';
    return v.status === 'cancelled' ? `Cancelled · ${shortDate(v.createdAt)}` : `Expired · ${shortDate(v.expiresAt)}`;
  })();
  const tone = (() => {
    if (tab === 'active') return { label: 'Active', color: 'var(--brand-500)' };
    if (tab === 'redeemed') return { label: 'Redeemed', color: 'var(--success)' };
    return { label: v.status === 'cancelled' ? 'Cancelled' : 'Expired', color: 'var(--text-tertiary)' };
  })();
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
          {v.dealTitle}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {v.customerFirstName ?? 'Customer'} · {v.variantLabel} · {sub}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {money(v.dealPriceCents)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: tone.color, marginTop: 2 }}>
          {tone.label.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

/* ---------- DEALS TAB ---------- */

const DEAL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:         { label: 'Live',      color: 'var(--success)' },
  pending_review: { label: 'In review', color: 'var(--brand-500)' },
  draft:          { label: 'Draft',     color: 'var(--text-tertiary)' },
  paused:         { label: 'Paused',    color: 'var(--text-tertiary)' },
  expired:        { label: 'Expired',   color: 'var(--text-tertiary)' },
  sold_out:       { label: 'Sold out',  color: 'var(--accent-500)' },
  rejected:       { label: 'Rejected',  color: 'var(--error)' },
};

function DealsTab({ onPost }: { onPost: () => void }) {
  const setupQuery = trpc.vendor.setupStatus.useQuery();
  const dealsQuery = trpc.vendor.listDeals.useQuery();
  const setup = setupQuery.data;
  const deals = dealsQuery.data ?? [];

  return (
    <>
      <div className="dash-header">
        <h1 style={{ fontSize: 28 }}>Deals</h1>
        {setup?.canPostDeals ? <Button onClick={onPost}>+ Post a deal</Button> : null}
      </div>
      {!setup?.canPostDeals ? (
        <SetupBanner setup={setup} />
      ) : (
        <DealList deals={deals} loading={dealsQuery.isLoading} />
      )}
    </>
  );
}

function DealList({ deals, loading }: { deals: VendorDeal[]; loading: boolean }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const setStatus = trpc.vendor.setDealStatus.useMutation({
    onSuccess: () => utils.vendor.listDeals.invalidate(),
  });

  if (loading) return null;
  return (
    <Card>
      {deals.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>
          No deals yet. Tap “+ Post a deal” to create your first one.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {deals.map((deal, i) => {
            const status = DEAL_STATUS_LABEL[deal.status] ?? DEAL_STATUS_LABEL.draft;
            const price = deal.headlinePriceCents != null ? money(deal.headlinePriceCents) : '—';
            const editable = deal.status !== 'expired' && deal.status !== 'sold_out';
            const expiry = expiryNote(deal.status, deal.expiresAt);
            return (
              <div
                key={deal.id}
                style={{ borderBottom: i === deals.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 'var(--radius-md)',
                      background: deal.primaryPhotoUrl
                        ? `center/cover url(${deal.primaryPhotoUrl})`
                        : 'var(--surface-secondary)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{deal.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                      {deal.categoryName} · {price} · {deal.variantCount} option{deal.variantCount === 1 ? '' : 's'}
                      {expiry ? ` · ${expiry}` : ''}
                    </div>
                  </div>
                  <span style={{ color: status?.color, fontSize: 13, fontWeight: 600 }}>{status?.label}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {deal.status === 'active' ? (
                      <DealAction label="Pause" onClick={() => setStatus.mutate({ dealId: deal.id, to: 'paused' })} disabled={setStatus.isPending} />
                    ) : null}
                    {deal.status === 'paused' ? (
                      <DealAction label="Resume" onClick={() => setStatus.mutate({ dealId: deal.id, to: 'active' })} disabled={setStatus.isPending} />
                    ) : null}
                    {deal.status === 'draft' ? (
                      <DealAction label="Submit" onClick={() => setStatus.mutate({ dealId: deal.id, to: 'pending_review' })} disabled={setStatus.isPending} />
                    ) : null}
                    {editable ? (
                      <DealAction label={deal.status === 'rejected' ? 'Fix' : 'Edit'} onClick={() => router.push(`/vendor/post?edit=${deal.id}`)} />
                    ) : null}
                  </div>
                </div>
                {deal.status === 'rejected' && deal.rejectionReason ? (
                  <div style={{ background: 'rgba(178,69,69,0.08)', border: '1px solid rgba(178,69,69,0.25)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--error)', fontWeight: 700, fontSize: 14 }}>⚠</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>Needs changes before it can go live</div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{deal.rejectionReason}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DealAction({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 999,
        border: '1px solid var(--border-default)',
        background: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
        opacity: disabled ? 0.5 : 1,
        minHeight: 36,
      }}
    >
      {label}
    </button>
  );
}

/* ---------- SETTINGS TAB ---------- */

function SettingsTab({ setup }: { setup: SetupData }) {
  return (
    <>
      <h1 style={{ fontSize: 28 }}>Settings</h1>
      <SetupChecklist setup={setup} />
      {setup?.canPostDeals ? <InstantPayoutCard /> : null}
      <StripeAccessCard />
    </>
  );
}

function InstantPayoutCard() {
  const utils = trpc.useUtils();
  const statusQ = trpc.vendor.instantPayoutStatus.useQuery();
  const toggle = trpc.vendor.setInstantPayoutEnabled.useMutation({
    onSuccess: () => {
      void utils.vendor.instantPayoutStatus.invalidate();
    },
  });
  const dashboard = trpc.vendor.stripeDashboardLink.useMutation({
    onSuccess: ({ url }) => window.open(url, '_blank'),
  });

  const optedIn = statusQ.data?.optedIn ?? false;
  const eligible = statusQ.data?.eligible ?? false;
  const reason = statusQ.data?.reason ?? null;
  const fee = statusQ.data?.feePercent ?? 3;

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Instant payouts</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
        Get paid in ~30 minutes for a {fee}% fee. Otherwise, Stripe pays you to your bank on its
        regular schedule (free, 1–2 business days).
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          padding: '12px 0',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Enable instant payouts ({fee}% fee)</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
            When ON, a “Pay me now” button appears on your Hub whenever you have a balance.
          </div>
        </div>
        <Toggle
          on={optedIn}
          disabled={toggle.isPending || statusQ.isLoading}
          onChange={(next) => toggle.mutate({ enabled: next })}
        />
      </div>

      {optedIn && !eligible ? (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'rgba(178,93,64,0.08)',
            border: '1px solid rgba(178,93,64,0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-500)' }}>
              One more step
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {reason ?? 'Add a debit card in your Stripe dashboard.'}
            </div>
          </div>
          <button
            onClick={() => dashboard.mutate()}
            disabled={dashboard.isPending}
            style={pillButton('brand')}
          >
            {dashboard.isPending ? '…' : 'Open Stripe'}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

function Toggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
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
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        transition: 'background 120ms',
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

function SetupChecklist({ setup }: { setup: SetupData }) {
  const onboard = trpc.vendor.startStripeOnboarding.useMutation({
    onSuccess: ({ onboardingUrl }) => {
      window.location.href = onboardingUrl;
    },
  });
  const startStripe = () => {
    const base = window.location.origin + '/vendor';
    onboard.mutate({ refreshUrl: base, returnUrl: base });
  };

  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Setup</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
        Required steps unlock posting. The rest make your listings shine.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SetupRow label="Business details" done required={false} last={false} />
        {STEPS.map((step, i) => (
          <SetupRow
            key={step.key}
            label={step.label}
            required={step.required}
            done={setup?.steps[step.key] ?? false}
            last={i === STEPS.length - 1}
            actionLabel={step.key === 'stripe' ? (onboard.isPending ? 'Opening…' : 'Connect bank') : 'Set up'}
            onAction={step.key === 'stripe' ? startStripe : undefined}
          />
        ))}
      </div>
    </Card>
  );
}

function StripeAccessCard() {
  const dashboard = trpc.vendor.stripeDashboardLink.useMutation({
    onSuccess: ({ url }) => window.open(url, '_blank'),
  });
  return (
    <Card>
      <h2 style={{ fontSize: 19, marginBottom: 4 }}>Stripe account</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 14 }}>
        View payouts, update your bank, or download tax forms.
      </p>
      <Button variant="secondary" onClick={() => dashboard.mutate()} disabled={dashboard.isPending}>
        {dashboard.isPending ? 'Opening…' : 'Open Stripe dashboard'}
      </Button>
      {dashboard.error ? (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>
          {dashboard.error.message}
        </div>
      ) : null}
    </Card>
  );
}

function SetupRow({
  label,
  done,
  required,
  last,
  actionLabel = 'Set up',
  onAction,
}: {
  label: string;
  done: boolean;
  required: boolean;
  last: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 180 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            flexShrink: 0,
            background: done ? 'var(--success)' : 'var(--surface-secondary)',
            border: done ? 'none' : '1px solid var(--border-default)',
            color: 'white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {done ? '✓' : ''}
        </span>
        <span style={{ fontSize: 15, color: done ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {label}
        </span>
        {required && !done ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--brand-600)',
              background: 'var(--brand-50)',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            REQUIRED
          </span>
        ) : null}
      </div>
      {!done ? (
        <Button variant="ghost" style={{ padding: '8px 14px', fontSize: 14, minHeight: 36 }} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

/* ---------- shared bits ---------- */

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 19, marginBottom: 4 }}>{children}</h2>;
}

function BigStat({ value, label, hero }: { value: string; label: string; hero?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: hero ? 30 : 24,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: hero ? 'var(--brand-600)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MoneyStat({
  label,
  value,
  sub,
  hero,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: hero ? 28 : 22,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          color: hero ? 'var(--brand-600)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
      {sub ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function TabChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: on ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
        background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
        color: on ? 'white' : 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
        minHeight: 32,
      }}
    >
      {children}
    </button>
  );
}

function pillButton(tone: 'error' | 'brand'): React.CSSProperties {
  const color = tone === 'error' ? 'var(--error)' : 'var(--brand-500)';
  return {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: color,
    color: 'white',
    minHeight: 36,
    flexShrink: 0,
  };
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Friendly expiry hint for live/paused deals. */
function expiryNote(status: string, expiresAt: string): string | null {
  if (status !== 'active' && status !== 'paused') return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86400_000);
  if (days >= 1) return `ends in ${days}d`;
  const hours = Math.max(1, Math.floor(ms / 3600_000));
  return `ends in ${hours}h`;
}

/* ---------- BOTTOM TABS (mobile-first nav) ---------- */

function BottomTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { key: Tab; icon: string; label: string }[] = [
    { key: 'hub',      icon: '◐', label: 'Hub' },
    { key: 'scan',     icon: '⛶', label: 'Scan' },
    { key: 'deals',    icon: '✦', label: 'Deals' },
    { key: 'settings', icon: '⚙', label: 'Settings' },
  ];
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: 'var(--surface-elevated)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        {items.map((item) => {
          const on = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: 'none',
                border: 'none',
                color: on ? 'var(--brand-600)' : 'var(--text-tertiary)',
                fontWeight: on ? 700 : 500,
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                minHeight: 56,
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
