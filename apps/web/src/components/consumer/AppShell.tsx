'use client';

import type { ReactNode } from 'react';

import { LocationProvider } from '../../lib/location';
import { Footer } from './Footer';
import { MobileTabBar } from './MobileTabBar';
import { TopNav } from './TopNav';

/**
 * Chrome for every consumer page: top nav on desktop, bottom tab bar on mobile,
 * footer in between. Wraps children in the LocationProvider so the nav's
 * location pill and the feeds share one location.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <LocationProvider>
      <div className="consumer-shell">
        <TopNav />
        <main className="consumer-main">{children}</main>
        <Footer />
        <MobileTabBar />
      </div>
    </LocationProvider>
  );
}
