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
      <TrendingSettings />
      <ReviewPushSettings />
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
  const [reviewId, setReviewId] = useState<string | null>(null);

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
                <button
                  onClick={() => setReviewId(d.id)}
                  title="Open full preview"
                  style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', flexShrink: 0, border: 'none', padding: 0, cursor: 'pointer', background: d.primaryPhotoUrl ? `center/cover url(${d.primaryPhotoUrl})` : 'var(--surface-secondary)' }}
                />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {d.businessName} · {d.categoryName} · {money(d.minPriceCents)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setReviewId(d.id)} style={reviewBtn}>Review →</button>
                  <button
                    onClick={() => review.mutate({ dealId: d.id, decision: 'approve' })}
                    disabled={review.isPending}
                    style={approveBtn}
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {reviewId ? (
        <DealReviewDrawer
          dealId={reviewId}
          onClose={() => setReviewId(null)}
          onReviewed={() => {
            setReviewId(null);
            void utils.admin.pendingDeals.invalidate();
            void utils.admin.pulse.invalidate();
          }}
        />
      ) : null}
    </Card>
  );
}

/**
 * Full-fidelity preview of a pending deal so you can actually SEE what you're
 * approving — every photo, the description, variants/pricing, what's-included,
 * restrictions, fine print, expiry. Three outcomes: Approve (goes live),
 * Request changes (soft bounce → draft with feedback, vendor can resubmit),
 * Reject (killed). Reason required for the latter two.
 */
function DealReviewDrawer({
  dealId, onClose, onReviewed,
}: {
  dealId: string;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const detail = trpc.admin.dealDetail.useQuery({ dealId });
  const review = trpc.admin.reviewDeal.useMutation({ onSuccess: onReviewed });
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'reject' | 'request_changes' | null>(null);
  const d = detail.data;

  const act = (decision: 'approve' | 'reject' | 'request_changes') => {
    if (decision !== 'approve' && reason.trim().length < 3) {
      setMode(decision);
      return;
    }
    review.mutate({ dealId, decision, reason: decision === 'approve' ? null : reason.trim() });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.45)', zIndex: 600, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px, 100vw)', height: '100%', background: 'var(--surface-elevated)', borderLeft: '1px solid var(--border-default)', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20 }}>Review deal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
        </div>

        {!d ? (
          <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700 }}>{d.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {d.vendorName} · {d.categoryName}{d.secondaryCategoryName ? ` + ${d.secondaryCategoryName}` : ''}{d.subtypeName ? ` · ${d.subtypeName}` : ''}
              </div>
            </div>

            {d.photoUrls.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {d.photoUrls.map((url, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt={`photo ${idx + 1}`} style={{ height: 150, borderRadius: 'var(--radius-md)', border: idx === 0 ? '2px solid var(--brand-500)' : '1px solid var(--border-subtle)' }} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--error)' }}>⚠ No photos on this deal.</div>
            )}

            <Block label="Description"><div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{d.description}</div></Block>

            <Block label={`Pricing (${d.variants.length} ${d.variants.length === 1 ? 'option' : 'options'})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {d.variants.map((v, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                    <span>{v.label}{v.unitCount ? ` · ${v.unitCount} ${v.unitLabel ?? ''}` : ''}{v.spotsTotal ? ` · ${v.spotsTotal} spots` : ''}</span>
                    <span style={{ fontWeight: 600 }}>
                      {money(v.dealPriceCents)} <span style={{ color: 'var(--text-tertiary)', textDecoration: 'line-through', fontWeight: 400 }}>{money(v.originalPriceCents)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Block>

            {d.whatsIncluded.length > 0 ? (
              <Block label="What's included"><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>{d.whatsIncluded.map((s, idx) => <li key={idx}>{s}</li>)}</ul></Block>
            ) : null}
            {d.restrictions.length > 0 ? (
              <Block label="Restrictions"><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>{d.restrictions.map((s, idx) => <li key={idx}>{s}</li>)}</ul></Block>
            ) : null}
            {d.finePrint ? <Block label="Fine print"><div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{d.finePrint}</div></Block> : null}

            <Block label="Terms">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Expires {new Date(d.expiresAt).toLocaleDateString()} · {d.perCustomerLimit} per customer · code valid {d.codeValidityDays} days
                {d.redemptionAddress ? <> · redeem at {d.redemptionAddress}</> : null}
              </div>
            </Block>

            {mode ? (
              <div style={{ padding: 12, background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  {mode === 'reject' ? 'Reject — tell the vendor why (they see this)' : 'Request changes — what should they fix? (they see this)'}
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder={mode === 'reject' ? 'e.g. before/after photos without consent' : 'e.g. add a clearer cover photo and fix the price typo'}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default)', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--surface-elevated)', paddingTop: 10 }}>
              <button onClick={() => act('reject')} disabled={review.isPending || (mode === 'reject' && reason.trim().length < 3)} style={rejectBtn}>
                {mode === 'reject' ? 'Confirm reject' : 'Reject…'}
              </button>
              <button onClick={() => act('request_changes')} disabled={review.isPending || (mode === 'request_changes' && reason.trim().length < 3)} style={requestBtn}>
                {mode === 'request_changes' ? 'Send back' : 'Request changes…'}
              </button>
              <button onClick={() => act('approve')} disabled={review.isPending} style={approveBtn}>Approve & go live</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

/** Tune the auto-"Trending" ribbon threshold (min purchases within N days). */
function TrendingSettings() {
  const utils = trpc.useUtils();
  const q = trpc.admin.getTrendingConfig.useQuery();
  const save = trpc.admin.setTrendingConfig.useMutation({
    onSuccess: () => { void utils.admin.getTrendingConfig.invalidate(); },
  });
  const [minPurchases, setMinPurchases] = useState('');
  const [windowDays, setWindowDays] = useState('');
  const [saved, setSaved] = useState(false);

  // Prefill once the config lands (only if the user hasn't typed yet).
  if (q.data && minPurchases === '' && windowDays === '') {
    setMinPurchases(String(q.data.minPurchases));
    setWindowDays(String(q.data.windowDays));
  }

  const submit = async () => {
    await save.mutateAsync({
      minPurchases: Math.max(1, parseInt(minPurchases, 10) || 3),
      windowDays: Math.max(1, parseInt(windowDays, 10) || 7),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Card>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Trending ribbon</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 14 }}>
        A deal shows the <strong>Trending</strong> ribbon when it hits this many paid purchases within the window. Auto-computed — no manual tagging.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Min purchases</span>
          <input type="number" min={1} value={minPurchases} onChange={(e) => setMinPurchases(e.target.value)} style={settingInput} />
        </label>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingBottom: 9 }}>within</span>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Window (days)</span>
          <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} style={settingInput} />
        </label>
        <button type="button" onClick={submit} disabled={save.isPending} style={linkBtn}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, paddingBottom: 9 }}>Saved ✓</span> : null}
      </div>
    </Card>
  );
}

/**
 * Toggle the post-redemption "leave a review" push. OFF by default: the wallet
 * already prompts for a review in-app on both mobile and web, which is the calm,
 * non-annoying default. Flip this on only if you want the extra push the moment
 * a voucher is redeemed. (Push delivery still requires the APNs key to be live.)
 */
function ReviewPushSettings() {
  const utils = trpc.useUtils();
  const q = trpc.admin.getReviewPromptPush.useQuery();
  const save = trpc.admin.setReviewPromptPush.useMutation({
    onSuccess: () => { void utils.admin.getReviewPromptPush.invalidate(); },
  });
  const enabled = q.data ?? false;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Review prompt push</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, maxWidth: 520 }}>
            Send a “leave a review” push the moment a voucher is redeemed. <strong>Off by default</strong> —
            the wallet already nudges for a review in-app, so leave this off unless you want the extra reminder.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={q.isLoading || save.isPending}
          onClick={() => save.mutate({ enabled: !enabled })}
          style={{
            flexShrink: 0,
            width: 52,
            height: 30,
            borderRadius: 999,
            border: 'none',
            cursor: q.isLoading ? 'default' : 'pointer',
            background: enabled ? 'var(--brand-500)' : 'var(--border-default)',
            position: 'relative',
            transition: 'background 120ms ease',
            opacity: save.isPending ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: enabled ? 25 : 3,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 120ms ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          />
        </button>
      </div>
    </Card>
  );
}

const settingInput: React.CSSProperties = {
  width: 90,
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};

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
const reviewBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--brand-500)', background: 'var(--surface-elevated)', color: 'var(--brand-600)', cursor: 'pointer',
};
const requestBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--brand-500)', background: 'var(--brand-50)', color: 'var(--brand-600)', cursor: 'pointer',
};
