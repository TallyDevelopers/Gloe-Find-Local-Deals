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
      <VoucherValiditySettings />
      <TrendingSettings />
      <DisputeRiskSettings />
      <NotificationsSettings />
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
                Expires {new Date(d.expiresAt).toLocaleDateString()} · {d.perCustomerLimit} per customer · code valid {d.codeValidityDays != null ? `${d.codeValidityDays} days (deal override)` : 'platform default'}
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

/**
 * Platform-wide voucher validity window (GLO-29). Every voucher issued from
 * now on expires this many days after purchase — no deploy needed to change
 * it. A deal can still carry its own override; already-issued vouchers keep
 * the expiry they were sold with.
 */
function VoucherValiditySettings() {
  const utils = trpc.useUtils();
  const q = trpc.admin.getVoucherValidityDays.useQuery();
  const save = trpc.admin.setVoucherValidityDays.useMutation({
    onSuccess: () => { void utils.admin.getVoucherValidityDays.invalidate(); },
  });
  const [days, setDays] = useState('');
  const [saved, setSaved] = useState(false);

  // Prefill once the config lands (only if the user hasn't typed yet).
  if (q.data && days === '') {
    setDays(String(q.data.days));
  }

  const submit = async () => {
    await save.mutateAsync({ days: Math.min(365, Math.max(1, parseInt(days, 10) || 90)) });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Card>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Voucher validity window</h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 14, maxWidth: 560 }}>
        How long a voucher stays redeemable after purchase. Applies to <strong>new</strong> vouchers
        the moment you save — already-issued vouchers keep the expiry they were sold with. A deal
        can still set its own override in the posting form.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Valid for (days)</span>
          <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} style={settingInput} />
        </label>
        <button type="button" onClick={submit} disabled={save.isPending} style={linkBtn}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, paddingBottom: 9 }}>Saved ✓</span> : null}
      </div>
    </Card>
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
 * Dispute-risk policy (GLO-34). YOU decide what "too many disputes" means —
 * the code doesn't guess. This sets the line that flips a vendor to the red
 * "⚠ high dispute rate" flag on the Vendors list + their detail page.
 */
function DisputeRiskSettings() {
  const utils = trpc.useUtils();
  const q = trpc.admin.getDisputeRiskConfig.useQuery();
  const save = trpc.admin.setDisputeRiskConfig.useMutation({
    onSuccess: () => {
      void utils.admin.getDisputeRiskConfig.invalidate();
      void utils.admin.vendorRoster.invalidate();
    },
  });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [maxDisputes, setMaxDisputes] = useState('');
  const [windowDays, setWindowDays] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill once the config lands (only if the user hasn't touched it yet).
  if (q.data && enabled === null && maxDisputes === '' && windowDays === '') {
    setEnabled(q.data.enabled);
    setMaxDisputes(String(q.data.maxDisputes));
    setWindowDays(String(q.data.windowDays));
  }

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync({
        enabled: enabled ?? true,
        maxDisputes: Math.max(1, parseInt(maxDisputes, 10) || 2),
        windowDays: Math.max(1, parseInt(windowDays, 10) || 90),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      // Owner-gated server-side — a moderator just sees this.
      setError(e instanceof Error ? e.message : 'Could not save. (Owner only.)');
    }
  };

  const n = Math.max(1, parseInt(maxDisputes, 10) || 2);
  const d = Math.max(1, parseInt(windowDays, 10) || 90);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Dispute-risk flag</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 4, maxWidth: 560 }}>
            There&apos;s no &quot;correct&quot; number of chargebacks that means a vendor is scamming —
            it depends on your category and tolerance. <strong>So you draw the line.</strong> When a vendor
            goes over it, god mode paints a red <strong>⚠ high dispute rate</strong> flag on the Vendors
            list and their detail page so you can decide whether to cut them. (It only flags — it never
            auto-suspends anyone.)
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 0, maxWidth: 560 }}>
            <strong>The toggle</strong> mutes the flag entirely (e.g. pre-launch, when there&apos;s no volume
            and every dispute is noise) without losing the number you picked.
          </p>
        </div>
        <Toggle on={enabled ?? true} disabled={save.isPending} onClick={() => setEnabled(!(enabled ?? true))} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginTop: 16, opacity: (enabled ?? true) ? 1 : 0.5 }}>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingBottom: 9 }}>Flag a vendor with more than</span>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Disputes</span>
          <input type="number" min={1} value={maxDisputes} onChange={(e) => setMaxDisputes(e.target.value)} style={settingInput} />
        </label>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingBottom: 9 }}>in the last</span>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Days</span>
          <input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} style={settingInput} />
        </label>
        <button type="button" onClick={submit} disabled={save.isPending} style={linkBtn}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {saved ? <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, paddingBottom: 9 }}>Saved ✓</span> : null}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, marginBottom: 0 }}>
        Right now: {(enabled ?? true)
          ? <>a vendor is flagged at <strong>{n + 1}+ disputes</strong> within <strong>{d} days</strong>.</>
          : <span style={{ color: 'var(--text-tertiary)' }}>flagging is off — no vendor is marked high-risk.</span>}
      </p>
      {error ? <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 6, marginBottom: 0 }}>{error}</p> : null}
    </Card>
  );
}

/** A reusable on/off switch, matching the rest of admin. */
function Toggle({
  on, disabled, onClick,
}: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      style={{
        flexShrink: 0, width: 52, height: 30, borderRadius: 999, border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: on ? 'var(--brand-500)' : 'var(--border-default)',
        position: 'relative', transition: 'background 120ms ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24,
        borderRadius: '50%', background: '#fff', transition: 'left 120ms ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}

/** Render a minutes count as a friendly delay label. */
function delayLabel(min: number): string {
  if (min <= 0) return 'Immediately';
  if (min < 60) return `${min} min later`;
  const h = min / 60;
  if (Number.isInteger(h)) return `${h} hour${h === 1 ? '' : 's'} later`;
  return `${h.toFixed(1)} hours later`;
}

/**
 * Notifications control panel — the single place to manage every push the app
 * sends. Each row is a registry type (notification_types): toggle it on/off, set
 * how long after the triggering event it fires, and edit the copy. Adding a new
 * push type server-side makes it appear here automatically.
 *
 * Heads-up: nothing actually delivers until APNs is live (the .p8 key + env
 * vars). These toggles control *intent*; delivery is gated on push being set up.
 */
function NotificationsSettings() {
  const utils = trpc.useUtils();
  const q = trpc.admin.listNotificationTypes.useQuery();
  const stats = trpc.admin.getNotificationQueueStats.useQuery();
  const save = trpc.admin.updateNotificationType.useMutation({
    onSuccess: () => {
      void utils.admin.listNotificationTypes.invalidate();
      void utils.admin.getNotificationQueueStats.invalidate();
    },
  });
  const types = q.data ?? [];

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18 }}>Notifications</h2>
        {stats.data ? (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {stats.data.pending} queued · {stats.data.sentLast24h} sent · {stats.data.skippedLast24h} skipped (24h)
          </span>
        ) : null}
      </div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 14, maxWidth: 560 }}>
        Every push the app can send. Toggle each on/off, set how long after the event it fires,
        and edit the copy. Delivery requires the APNs key to be live — until then these set intent only.
      </p>
      {q.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {types.map((t, i) => (
            <NotificationRow
              key={t.key}
              type={t}
              first={i === 0}
              saving={save.isPending && save.variables?.key === t.key}
              onToggle={() => save.mutate({ key: t.key, enabled: !t.enabled })}
              onSave={(patch) => save.mutate({ key: t.key, ...patch })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface NotifType {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  delayMinutes: number;
  titleTemplate: string;
  bodyTemplate: string;
  threadId: string | null;
  updatedAt: string;
}

function NotificationRow({
  type, first, saving, onToggle, onSave,
}: {
  type: NotifType;
  first: boolean;
  saving: boolean;
  onToggle: () => void;
  onSave: (patch: { delayMinutes?: number; titleTemplate?: string; bodyTemplate?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(type.delayMinutes / 60));
  const [title, setTitle] = useState(type.titleTemplate);
  const [body, setBody] = useState(type.bodyTemplate);

  const saveEdits = () => {
    const h = parseFloat(hours);
    onSave({
      delayMinutes: Number.isFinite(h) && h >= 0 ? Math.round(h * 60) : type.delayMinutes,
      titleTemplate: title.trim() || type.titleTemplate,
      bodyTemplate: body.trim() || type.bodyTemplate,
    });
    setEditing(false);
  };

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--border-subtle)', padding: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{type.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
              {delayLabel(type.delayMinutes)}
            </span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 3, maxWidth: 520 }}>{type.description}</p>
          {!editing ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              <span style={{ fontWeight: 600 }}>{type.titleTemplate}</span> — {type.bodyTemplate}
              <button onClick={() => setEditing(true)} style={editLink}>Edit</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, padding: 12, background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
              <label style={fieldLabel}>Delay (hours after the event — 0 = immediately)
                <input type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} style={settingInput} />
              </label>
              <label style={fieldLabel}>Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...settingInput, width: '100%' }} />
              </label>
              <label style={fieldLabel}>Body (use {'{{vendorName}}'} etc. for variables)
                <input value={body} onChange={(e) => setBody(e.target.value)} style={{ ...settingInput, width: '100%' }} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveEdits} disabled={saving} style={linkBtn}>{saving ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setEditing(false); setHours(String(type.delayMinutes / 60)); setTitle(type.titleTemplate); setBody(type.bodyTemplate); }} style={cancelBtn}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        <Toggle on={type.enabled} disabled={saving} onClick={onToggle} />
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-tertiary)',
};
const editLink: React.CSSProperties = {
  marginLeft: 8, padding: 0, border: 'none', background: 'none',
  color: 'var(--brand-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-default)', color: 'var(--text-secondary)', cursor: 'pointer',
};

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
