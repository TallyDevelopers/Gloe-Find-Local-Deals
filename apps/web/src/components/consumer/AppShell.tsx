'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { LocationProvider } from '../../lib/location';
import { Footer } from './Footer';
import { MobileHeader } from './MobileHeader';
import { StickySearch } from './StickySearch';
import { TopNav } from './TopNav';

/**
 * Chrome for every consumer page: a top header on both desktop (TopNav) and
 * mobile (MobileHeader) — the mobile web reads as a real website (header nav +
 * hamburger menu), not a native app. Wraps children in the LocationProvider so
 * the nav's location pill and the feeds share one location.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // On the home page the header floats transparently over the hero, so the hero
  // is pulled up beneath it (`--home`). Other pages keep the header in flow.
  const isHome = usePathname() === '/';

  return (
    <LocationProvider>
      <div className="consumer-shell">
        <TopNav />
        <MobileHeader />
        <StickySearch />
        <main className={`consumer-main${isHome ? ' consumer-main--home' : ''}`}>{children}</main>
        <Footer />
      </div>
    </LocationProvider>
  );
}
