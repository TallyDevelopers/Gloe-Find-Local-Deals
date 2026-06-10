import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandPanel } from './BrandPanel';
import { Wordmark } from './Wordmark';

/**
 * Split-screen shell for business-bound auth (sign-in/sign-up reached with
 * `redirect_url=/vendor*`). Reuses the vendor signup's dark brand panel so
 * /business → auth → /vendor reads as ONE continuous flow instead of bouncing
 * through a generic consumer login. Children = the Clerk card.
 */
export function BizAuthShell({ children }: { children: ReactNode }) {
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
        <div className="biz-form-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="biz-mobile-brand" style={{ alignSelf: 'flex-start' }}>
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
          {children}
        </div>
      </main>
    </div>
  );
}
