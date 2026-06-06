'use client';

import { useSignInModal } from './useSignInModal';

/**
 * Friendly sign-in prompt for account-gated consumer pages (saved, wallet,
 * account). Opens Clerk's slide-in modal and returns the shopper to the current
 * page after auth.
 */
export function SignInGate({ title, subtitle }: { title: string; subtitle: string }) {
  const openSignIn = useSignInModal();
  return (
    <div className="consumer-container" style={{ maxWidth: 520, paddingTop: 64 }}>
      <div
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 32px',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(43,32,25,0.06)',
        }}
      >
        <h1 style={{ fontSize: 26 }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>{subtitle}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => openSignIn()}
            style={{ background: 'var(--brand-500)', color: 'var(--text-inverse)', padding: '13px 28px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
