'use client';

import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { Button, Card } from '../../components/ui';
import { Wordmark } from '../../components/Wordmark';
import { trpc } from '../../lib/trpc';

interface VendorDashboardProps {
  vendor: { id: string; businessName: string; slug: string; status: string };
}

type SetupData = RouterOutputs['vendor']['setupStatus'] | undefined;

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

export function VendorDashboard({ vendor }: VendorDashboardProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const setupQuery = trpc.vendor.setupStatus.useQuery();
  const dealsQuery = trpc.vendor.listDeals.useQuery();
  const setup = setupQuery.data;
  const deals = dealsQuery.data ?? [];

  // Sweep any elapsed deals to 'expired' on load so the list is accurate.
  const sweep = trpc.vendor.sweepExpired.useMutation();
  useEffect(() => {
    sweep.mutateAsync().then((r) => {
      if (r.expired > 0) void utils.vendor.listDeals.invalidate();
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)' }}>
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Wordmark size={24} tone="gold" />
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
              FOR BUSINESS
            </span>
          </div>
          <UserButton />
        </div>
      </header>

      <main className="page-main" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Hero
          vendor={vendor}
          setup={setup}
          loading={setupQuery.isLoading}
          onPost={() => router.push('/vendor/post')}
        />
        {setup?.canPostDeals ? null : <SetupChecklist setup={setup} />}
        {setup?.canPostDeals ? <DealList deals={deals} loading={dealsQuery.isLoading} /> : null}
        <StatRow />
      </main>
    </div>
  );
}

function Hero({
  vendor,
  setup,
  loading,
  onPost,
}: {
  vendor: VendorDashboardProps['vendor'];
  setup: SetupData;
  loading: boolean;
  onPost: () => void;
}) {
  const pending = vendor.status === 'pending_approval' || vendor.status === 'rejected';
  const approved = setup?.isApproved ?? vendor.status === 'active';
  const canPost = setup?.canPostDeals ?? false;

  let eyebrow: string;
  let eyebrowColor: string;
  let note: string;
  let ctaLabel: string;
  let ctaDisabled: boolean;

  if (canPost) {
    eyebrow = '● Active';
    eyebrowColor = 'var(--success)';
    note = "You're all set. Post a deal and start reaching clients searching near you right now.";
    ctaLabel = '+ Post a deal';
    ctaDisabled = false;
  } else if (approved) {
    eyebrow = '✦ You’re approved!';
    eyebrowColor = 'var(--success)';
    note =
      'Welcome to Gloē — so glad to have you. Just a couple things left, then you can post your first deal and start reaching clients near you.';
    ctaLabel = 'Finish setup';
    ctaDisabled = false;
  } else if (pending) {
    eyebrow = '● Pending review';
    eyebrowColor = 'var(--brand-500)';
    note =
      "We're reviewing your account — usually within a day. Finish your setup now so you're ready to post the moment you're approved.";
    ctaLabel = 'Post a deal';
    ctaDisabled = true;
  } else {
    eyebrow = `● ${vendor.status}`;
    eyebrowColor = 'var(--text-tertiary)';
    note = 'Contact support to reactivate your account.';
    ctaLabel = 'Post a deal';
    ctaDisabled = true;
  }

  return (
    <>
      <div className="dash-header">
        <div>
          <h1 style={{ fontSize: 36 }}>{vendor.businessName}</h1>
          <span style={{ color: eyebrowColor, fontWeight: 600, fontSize: 15 }}>{eyebrow}</span>
        </div>
        <Button disabled={ctaDisabled || loading} onClick={ctaDisabled ? undefined : onPost}>
          {ctaLabel}
        </Button>
      </div>

      <Card style={{ background: approved && !canPost ? 'var(--brand-50)' : 'var(--surface-secondary)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>{note}</p>
      </Card>
    </>
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
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Finish your setup</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 20 }}>
        Required steps unlock posting. The rest make your listings shine.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label="Business details" done required={false} last={false} />
        {STEPS.map((step, i) => (
          <Row
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

function Row({
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
        padding: '14px 0',
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        <span style={{ fontSize: 16, color: done ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
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
        <Button variant="ghost" style={{ padding: '6px 14px', fontSize: 14 }} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

type VendorDeal = RouterOutputs['vendor']['listDeals'][number];

const DEAL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'Live', color: 'var(--success)' },
  pending_review: { label: 'In review', color: 'var(--brand-500)' },
  draft: { label: 'Draft', color: 'var(--text-tertiary)' },
  paused: { label: 'Paused', color: 'var(--text-tertiary)' },
  expired: { label: 'Expired', color: 'var(--text-tertiary)' },
  sold_out: { label: 'Sold out', color: 'var(--accent-500)' },
  rejected: { label: 'Rejected', color: 'var(--error)' },
};

function DealList({ deals, loading }: { deals: VendorDeal[]; loading: boolean }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const setStatus = trpc.vendor.setDealStatus.useMutation({
    onSuccess: () => utils.vendor.listDeals.invalidate(),
  });

  if (loading) return null;
  return (
    <Card>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Your deals</h2>
      {deals.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 15 }}>
          No deals yet. Tap “+ Post a deal” to create your first one.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {deals.map((deal, i) => {
            const status = DEAL_STATUS_LABEL[deal.status] ?? DEAL_STATUS_LABEL.draft;
            const price = deal.headlinePriceCents != null ? `$${(deal.headlinePriceCents / 100).toFixed(0)}` : '—';
            const editable = deal.status !== 'expired' && deal.status !== 'sold_out';
            const expiry = expiryNote(deal.status, deal.expiresAt);
            return (
              <div
                key={deal.id}
                style={{
                  borderBottom: i === deals.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 0',
                  flexWrap: 'wrap',
                }}
              >
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
                    <DealAction label={deal.status === 'rejected' ? 'Fix & resubmit' : 'Edit'} onClick={() => router.push(`/vendor/post?edit=${deal.id}`)} />
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
        padding: '6px 12px',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 999,
        border: '1px solid var(--border-default)',
        background: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
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

function StatRow() {
  const stats = [
    { label: 'Active deals', value: '0' },
    { label: 'Redemptions this month', value: '0' },
    { label: 'Earnings this month', value: '$0' },
  ];
  return (
    <div className="stat-grid">
      {stats.map((stat) => (
        <Card key={stat.label} style={{ padding: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {stat.value}
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{stat.label}</div>
        </Card>
      ))}
    </div>
  );
}
