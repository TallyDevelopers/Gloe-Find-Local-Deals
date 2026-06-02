'use client';

import { useState } from 'react';

import { Check, Share, X } from './icons';

/**
 * Share-to-pay sheet. Opens after a gift link is generated and adapts to the
 * device: where the Web Share API exists (iOS/Mac/most phones) it offers the
 * native share sheet; everywhere else (typical Windows PC) it shows a copyable
 * link with an explicit "Copied!" confirmation plus Text / Email shortcuts.
 * Also explains, warmly, what share-to-pay actually is.
 */
export function SharePayModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const message = "Here's a secure Gloē link if you'd like to treat me — checkout takes a sec and the voucher comes straight to me 💛";
  const smsHref = `sms:?&body=${encodeURIComponent(`${message} ${url}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent('A little something for me on Gloē')}&body=${encodeURIComponent(`${message}\n\n${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the link is still selectable in the field */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: 'Cover my Gloē booking', text: message, url: url! });
    } catch {
      /* user dismissed */
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(43,32,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', padding: 26, boxShadow: '0 24px 60px rgba(43,32,25,0.28)', position: 'relative' }}
      >
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
          <X size={20} color="var(--text-tertiary)" />
        </button>

        <div style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-50)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Share size={22} color="var(--brand-600)" />
        </div>
        <h2 style={{ fontSize: 23 }}>Let someone treat you</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 8 }}>
          Send this link to whoever’s treating you — a partner, parent, friend. They check out securely,
          and the voucher drops <strong style={{ color: 'var(--text-primary)' }}>straight into your wallet</strong>. You don’t pay a thing.
        </p>

        {/* Copyable link */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            style={{ flex: 1, fontSize: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-primary)', color: 'var(--text-secondary)', outline: 'none', minWidth: 0 }}
          />
          <button
            type="button"
            onClick={copy}
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: copied ? 'var(--success)' : 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-md)', padding: '0 16px', fontSize: 14, fontWeight: 700 }}
          >
            {copied ? <Check size={16} color="var(--text-inverse)" /> : null}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Device-aware actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {canNativeShare ? (
            <button type="button" onClick={nativeShare} style={actionBtn(true)}>
              <Share size={16} color="var(--text-inverse)" /> Share…
            </button>
          ) : null}
          <a href={smsHref} style={actionBtn(false)}>Text</a>
          <a href={emailHref} style={actionBtn(false)}>Email</a>
        </div>

        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
          Secure checkout via Stripe · Apple Pay accepted · Link expires for safety
        </p>
      </div>
    </div>
  );
}

function actionBtn(primary: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '12px 14px',
    borderRadius: 'var(--radius-pill)',
    border: primary ? 'none' : '1px solid var(--border-default)',
    background: primary ? 'var(--brand-500)' : 'var(--surface-elevated)',
    color: primary ? 'var(--text-inverse)' : 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  };
}
