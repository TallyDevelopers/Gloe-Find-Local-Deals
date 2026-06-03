import Link from 'next/link';

import { Wordmark } from '../Wordmark';

/**
 * Marketplace footer. Carries the quiet "For Businesses" entry point alongside
 * legal + about links. Sits above the mobile tab bar (which has its own spacer).
 */
export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--surface-elevated)',
        marginTop: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '40px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 28,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <Wordmark size={24} tone="gold" />
          <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Beauty + wellness, beautifully booked. Vetted, top-rated medspas near you.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
          <FooterCol title="Explore">
            <FooterLink href="/">Discover</FooterLink>
            <FooterLink href="/search">Search</FooterLink>
            <FooterLink href="/wallet">Your wallet</FooterLink>
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink href="/business">For Businesses</FooterLink>
            <FooterLink href="/support">Concierge</FooterLink>
            <FooterLink href="/legal/terms">Terms</FooterLink>
            <FooterLink href="/legal/privacy">Privacy</FooterLink>
          </FooterCol>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 24px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        © {2026} Gloē · Made with care
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
      {children}
    </Link>
  );
}
