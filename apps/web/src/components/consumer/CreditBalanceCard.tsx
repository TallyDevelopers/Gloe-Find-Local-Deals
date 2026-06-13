'use client';

import { useState } from 'react';

import { trpc } from '../../lib/trpc';
import { formatCredit } from './format';
import { ChevronDown } from './icons';

/**
 * Wallet credit summary card (GLO-24) — available balance, the referee's
 * locked welcome credit with its unlock condition, the soonest expiry, and a
 * collapsible ledger history. Credit states stay in the brand palette (never
 * semantic success green), matching mobile.
 */

const HISTORY_LABELS: Record<string, string> = {
  referral_give: 'Referral welcome credit',
  referral_get: 'Referral reward',
  purchase_reward: 'Booking reward',
  signup_bonus: 'Welcome bonus',
  promo: 'Gloē promo credit',
  admin_grant: 'Gloē credit',
  refund_return: 'Credit returned from a refund',
  redemption: 'Applied to a booking',
  expiry: 'Credit expired',
  clawback: 'Credit reversed',
  forfeiture: 'Credit forfeited',
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CreditBalanceCard() {
  const balance = trpc.credits.balance.useQuery();
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = trpc.credits.history.useQuery(undefined, { enabled: historyOpen });

  const b = balance.data;
  // Nothing to say until the user has (or had) credit in play.
  if (!b || (b.availableCents <= 0 && b.lockedCents <= 0 && !b.frozen)) return null;

  return (
    <div style={{ marginTop: 18, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          Gloē credit
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatCredit(b.availableCents)}
          </span>
          {b.availableCents > 0 ? (
            <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>applies automatically at checkout</span>
          ) : null}
        </div>

        {b.lockedCents > 0 ? (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--radius-md)', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: 'var(--brand-700)' }}>{formatCredit(b.lockedCents)} welcome credit</span>
            {' '}unlocks on your first booking{b.lockedFloorCents > 0 ? ` of ${formatCredit(b.lockedFloorCents)}+` : ''}.
          </div>
        ) : null}

        {b.soonestExpiry ? (
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--brand-600)' }}>
            {formatCredit(b.soonestExpiry.amountCents)} expires {shortDate(b.soonestExpiry.expiresAt)} — use it before it's gone
          </div>
        ) : null}

        {b.frozen ? (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Your credit is on hold while we review a payment dispute.
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setHistoryOpen((v) => !v)}
        aria-expanded={historyOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 18px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', font: 'inherit', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>History</span>
        <ChevronDown size={16} color="var(--text-tertiary)" style={{ transform: historyOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
      </button>

      {historyOpen ? (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {history.isLoading ? (
            <p style={{ padding: '14px 18px', fontSize: 13.5, color: 'var(--text-tertiary)' }}>Loading…</p>
          ) : (history.data ?? []).length === 0 ? (
            <p style={{ padding: '14px 18px', fontSize: 13.5, color: 'var(--text-tertiary)' }}>No credit activity yet.</p>
          ) : (
            (history.data ?? []).map((row) => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {HISTORY_LABELS[row.kind] ?? 'Credit activity'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{shortDate(row.createdAt)}</div>
                </div>
                <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 14, color: row.amountCents >= 0 ? 'var(--brand-700)' : 'var(--text-secondary)' }}>
                  {row.amountCents >= 0 ? '+' : '−'}{formatCredit(Math.abs(row.amountCents))}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
