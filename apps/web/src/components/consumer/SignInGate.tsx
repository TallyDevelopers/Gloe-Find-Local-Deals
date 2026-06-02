'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Friendly sign-in prompt for account-gated consumer pages (saved, wallet,
 * account). Returns the shopper to the current page after auth.
 */
export function SignInGate({ title, subtitle }: { title: string; subtitle: string }) {
  const pathname = usePathname();
  const href = `/sign-in?redirect_url=${encodeURIComponent(pathname)}`;
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
          <Link
            href={href}
            style={{ background: 'var(--brand-500)', color: 'var(--text-inverse)', padding: '13px 28px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 15 }}
          >
            Sign in
          </Link>
          <Link
            href={`/sign-up?redirect_url=${encodeURIComponent(pathname)}`}
            style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', padding: '13px 28px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 15 }}
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
