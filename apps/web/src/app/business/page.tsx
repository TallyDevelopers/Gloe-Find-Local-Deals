import { SignedIn, SignedOut } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '../../components/ui';
import { Wordmark } from '../../components/Wordmark';

export const metadata: Metadata = {
  title: 'For Businesses',
  description:
    'Post your aesthetic deals on Gloē. Reach new clients near you and get paid when they book — no monthly fees, no upfront cost.',
};

/**
 * Business / vendor acquisition landing. This used to live at `/`; the root is
 * now the consumer marketplace, so the business pitch moved here and is linked
 * from the consumer footer ("For Businesses"). Auth routes the vendor straight
 * into their portal at /vendor.
 */
export default function ForBusinessPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <div>
          <Wordmark size={40} tone="gold" />
          <div style={{ fontSize: 13, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 6 }}>
            FOR BUSINESS
          </div>
        </div>
        <h1 style={{ fontSize: 52, lineHeight: 1.1 }}>Turn deal-seekers into clients</h1>
        <p style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Post your aesthetic deals. Reach new clients near you. Get paid when they book —
          no monthly fees, no upfront cost.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <SignedOut>
            <Link href="/sign-up?redirect_url=/vendor">
              <Button>Get started — it&apos;s free</Button>
            </Link>
            <Link href="/sign-in?redirect_url=/vendor">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/vendor">
              <Button>Go to your dashboard</Button>
            </Link>
          </SignedIn>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 16 }}>
          We only earn a small fee when a customer claims one of your deals. Way less than Groupon.
        </p>

        <Link href="/" style={{ fontSize: 14, color: 'var(--brand-600)', fontWeight: 600, marginTop: 8 }}>
          ← Back to Gloē
        </Link>
      </div>
    </main>
  );
}
