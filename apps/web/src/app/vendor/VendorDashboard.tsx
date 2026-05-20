'use client';

import { UserButton } from '@clerk/nextjs';

import { Button, Card } from '../../components/ui';
import { Wordmark } from '../../components/Wordmark';

interface VendorDashboardProps {
  vendor: { id: string; businessName: string; slug: string; status: string };
}

interface StatusCopy {
  label: string;
  color: string;
  note: string;
}

const PENDING: StatusCopy = {
  label: 'Pending review',
  color: 'var(--brand-500)',
  note: "We're reviewing your account. You can set up your deals now — they'll go live once you're approved.",
};

const STATUS_COPY: Record<string, StatusCopy> = {
  pending_approval: PENDING,
  active: {
    label: 'Active',
    color: 'var(--success)',
    note: 'Your account is live. Post deals and start reaching customers.',
  },
  paused: { label: 'Paused', color: 'var(--text-tertiary)', note: 'Your account is paused.' },
  suspended: { label: 'Suspended', color: 'var(--error)', note: 'Contact support.' },
  rejected: { label: 'Not approved', color: 'var(--error)', note: 'Contact support.' },
};

export function VendorDashboard({ vendor }: VendorDashboardProps) {
  const status: StatusCopy = STATUS_COPY[vendor.status] ?? PENDING;

  const setupSteps = [
    { label: 'Business details', done: true },
    { label: 'Medical license & verification', done: false },
    { label: 'Add a provider', done: false },
    { label: 'Practice photos', done: false },
    { label: 'Connect bank for payouts (Stripe)', done: false },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-elevated)',
        }}
      >
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
        {/* Header */}
        <div className="dash-header">
          <div>
            <h1 style={{ fontSize: 36 }}>{vendor.businessName}</h1>
            <span style={{ color: status.color, fontWeight: 600, fontSize: 15 }}>● {status.label}</span>
          </div>
          <Button disabled={vendor.status !== 'active'}>+ Post a deal</Button>
        </div>

        <Card style={{ background: 'var(--brand-50)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>{status.note}</p>
        </Card>

        {/* Setup checklist */}
        <Card>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Finish your setup</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {setupSteps.map((step) => (
              <div
                key={step.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: step.done ? 'var(--success)' : 'var(--surface-secondary)',
                      color: step.done ? 'white' : 'var(--text-tertiary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {step.done ? '✓' : ''}
                  </span>
                  <span style={{ fontSize: 16, color: step.done ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                    {step.label}
                  </span>
                </div>
                {!step.done ? <Button variant="ghost" style={{ padding: '6px 12px', fontSize: 14 }}>Set up</Button> : null}
              </div>
            ))}
          </div>
        </Card>

        {/* Stats placeholder */}
        <div className="stat-grid">
          {[
            { label: 'Active deals', value: '0' },
            { label: 'Redemptions this month', value: '0' },
            { label: 'Earnings this month', value: '$0' },
          ].map((stat) => (
            <Card key={stat.label} style={{ padding: 24 }}>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{stat.value}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{stat.label}</div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
