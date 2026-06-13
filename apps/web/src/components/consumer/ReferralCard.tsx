'use client';

import { useState } from 'react';

import { trpc } from '../../lib/trpc';
import { formatCredit } from './format';
import { Check, Copy, Gift, Share } from './icons';

/**
 * "Give $20, get $20" invite card (GLO-24) — the user's shareable /r/CODE
 * link with copy + native share. Amounts come from the active referral rule
 * (admin-editable), never hardcoded; the card hides itself when the program
 * is paused. Rendered on /wallet and /account.
 */
export function ReferralCard() {
  const program = trpc.referral.program.useQuery();
  const code = trpc.referral.getCode.useQuery(undefined, { enabled: !!program.data });
  const status = trpc.referral.status.useQuery(undefined, { enabled: !!program.data });
  const [copied, setCopied] = useState(false);

  const p = program.data;
  if (!p) return null;
  const url = code.data?.url ?? null;
  // Captured for the hoisted handlers below — TS narrowing doesn't reach them.
  const giveCents = p.giveCents;

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, permissions) — the visible code
      // is still there to copy by hand.
    }
  }

  async function shareLink() {
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Gloē',
          text: `Here's ${formatCredit(giveCents)} off your first booking on Gloē`,
          url,
        });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
    } else {
      await copyLink();
    }
  }

  const s = status.data;
  const scoreboard =
    s && s.invited > 0
      ? `${s.invited} ${s.invited === 1 ? 'friend' : 'friends'} joined${s.earnedCents > 0 ? ` · ${formatCredit(s.earnedCents)} earned` : ''}`
      : null;

  return (
    <div style={{ marginTop: 18, background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--radius-lg)', padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Gift size={20} color="var(--brand-600)" />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--text-primary)' }}>
          Give {formatCredit(p.giveCents)}, get {formatCredit(p.getCents)}
        </span>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
        Friends get {formatCredit(p.giveCents)} off their first booking
        {p.minFirstPurchaseCents > 0 ? ` of ${formatCredit(p.minFirstPurchaseCents)}+` : ''} — you get{' '}
        {formatCredit(p.getCents)} when they book.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', background: 'var(--surface-elevated)', border: '1px dashed var(--brand-500)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 15, letterSpacing: '0.08em', textAlign: 'center', color: 'var(--brand-700)' }}>
          {code.data?.code ?? '······'}
        </div>
        <button
          type="button"
          onClick={copyLink}
          disabled={!url}
          aria-label="Copy invite link"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'var(--surface-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
        >
          {copied ? <Check size={17} color="var(--brand-600)" /> : <Copy size={17} color="var(--text-secondary)" />}
        </button>
        <button
          type="button"
          onClick={shareLink}
          disabled={!url}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          <Share size={15} color="var(--text-inverse)" /> Share
        </button>
      </div>

      {scoreboard ? (
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-600)', marginTop: 10 }}>{scoreboard}</p>
      ) : null}
    </div>
  );
}
