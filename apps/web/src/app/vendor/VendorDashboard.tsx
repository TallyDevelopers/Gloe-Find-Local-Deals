'use client';

import { UserButton } from '@clerk/nextjs';

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
  const setupQuery = trpc.vendor.setupStatus.useQuery();
  const setup = setupQuery.data;

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
        <Hero vendor={vendor} setup={setup} loading={setupQuery.isLoading} />
        {setup?.canPostDeals ? null : <SetupChecklist setup={setup} />}
        <StatRow />
      </main>
    </div>
  );
}

function Hero({
  vendor,
  setup,
  loading,
}: {
  vendor: VendorDashboardProps['vendor'];
  setup: SetupData;
  loading: boolean;
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
        <Button disabled={ctaDisabled || loading}>{ctaLabel}</Button>
      </div>

      <Card style={{ background: approved && !canPost ? 'var(--brand-50)' : 'var(--surface-secondary)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.5 }}>{note}</p>
      </Card>
    </>
  );
}

function SetupChecklist({ setup }: { setup: SetupData }) {
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
}: {
  label: string;
  done: boolean;
  required: boolean;
  last: boolean;
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
        <Button variant="ghost" style={{ padding: '6px 14px', fontSize: 14 }}>
          Set up
        </Button>
      ) : null}
    </div>
  );
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
