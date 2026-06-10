import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandPanel } from './BrandPanel';
import { Wordmark } from './Wordmark';

/**
 * Split-screen shell for business-bound auth (sign-in/sign-up reached with
 * `redirect_url=/vendor*`). Reuses the vendor signup's dark brand panel so
 * /business → auth → /vendor reads as ONE continuous flow instead of bouncing
 * through a generic consumer login. Children = the Clerk card (rendered with
 * CLERK_BIZ_APPEARANCE, which strips Clerk's own logo/header — the shell owns
 * the branding and the heading below).
 */
export function BizAuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="biz-layout">
      {/* Left brand panel — hidden on narrow screens */}
      <div className="brand-panel-wrap" style={{ display: 'flex', flex: '1 1 0', minWidth: 0 }}>
        <BrandPanel />
      </div>

      <main className="biz-form-col">
        <div className="biz-utility-row">
          <Link href="/business" className="biz-utility-link">← For Businesses</Link>
          <Link href="/" className="biz-utility-link">gloe.app</Link>
        </div>
        <div className="biz-form-inner">
          <div className="biz-mobile-brand">
            <Wordmark size={26} tone="gold" />
            <span
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
              }}
            >
              FOR BUSINESS
            </span>
          </div>
          <h1>{title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.55, marginTop: 10 }}>
            {subtitle}
          </p>
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>{children}</div>
        </div>
      </main>
    </div>
  );
}
