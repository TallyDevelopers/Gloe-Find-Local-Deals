'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

function money(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function SettingsView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Settings</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Admin queues and platform configuration.
        </p>
      </div>
      <DealReviewQueue />
      <Card>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Platform fees</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
          Add, edit, deactivate global tiers. Per-vendor overrides live on each vendor's detail page.
        </p>
        <a href="/admin/fees" style={linkBtn}>Open Fees editor →</a>
      </Card>
      <Card>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Add a spa</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
          Create an unclaimed vendor and post deals on their behalf.
        </p>
        <a href="/admin/add-spa" style={linkBtn}>+ Add a spa</a>
      </Card>
    </div>
  );
}

function DealReviewQueue() {
  const utils = trpc.useUtils();
  const q = trpc.admin.pendingDeals.useQuery();
  const review = trpc.admin.reviewDeal.useMutation({
    onSuccess: () => { void utils.admin.pendingDeals.invalidate(); void utils.admin.pulse.invalidate(); },
  });
  const [reason, setReason] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = q.data ?? [];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h2 style={{ fontSize: 18 }}>Deals waiting for review</h2>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{rows.length} pending</span>
      </div>
      {q.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Nothing waiting.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((d, i) => (
            <div key={d.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', flexShrink: 0, background: d.primaryPhotoUrl ? `center/cover url(${d.primaryPhotoUrl})` : 'var(--surface-secondary)' }} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {d.businessName} · {d.categoryName} · {money(d.minPriceCents)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => review.mutate({ dealId: d.id, decision: 'approve' })}
                    disabled={review.isPending}
                    style={approveBtn}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setOpenId(openId === d.id ? null : d.id)}
                    style={ghostBtn}
                  >
                    Reject…
                  </button>
                </div>
              </div>
              {openId === d.id ? (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <input
                    value={reason[d.id] ?? ''}
                    onChange={(e) => setReason({ ...reason, [d.id]: e.target.value })}
                    placeholder="Why? (vendor sees this)"
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default)' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setOpenId(null)} style={ghostBtn}>Cancel</button>
                    <button
                      onClick={() => review.mutate({ dealId: d.id, decision: 'reject', reason: reason[d.id] ?? '' })}
                      disabled={review.isPending || !(reason[d.id] ?? '').trim()}
                      style={rejectBtn}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 18,
    }}>{children}</div>
  );
}

const linkBtn: React.CSSProperties = {
  display: 'inline-block', padding: '8px 14px',
  background: 'var(--brand-500)', color: 'white', textDecoration: 'none',
  borderRadius: 999, fontSize: 13, fontWeight: 700,
};
const approveBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--success)', background: 'var(--success)', color: 'white',
};
const rejectBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--error)', background: 'var(--error)', color: 'white',
};
const ghostBtn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
};
