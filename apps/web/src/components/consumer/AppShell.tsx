'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { LocationProvider } from '../../lib/location';
import { AppDownloadRibbon } from './AppDownloadRibbon';
import { Footer } from './Footer';
import { MobileHeader } from './MobileHeader';
import { StickySearch } from './StickySearch';
import { TopNav } from './TopNav';

const RIBBON_DISMISS_KEY = 'gloe.appRibbonDismissed.v1';

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

  // App-download ribbon: shown after mount (avoids SSR flash) unless dismissed.
  // CSS hides it on desktop; `has-app-ribbon` offsets the over-hero home header.
  const [showRibbon, setShowRibbon] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(RIBBON_DISMISS_KEY) !== '1') setShowRibbon(true);
  }, []);
  const dismissRibbon = () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(RIBBON_DISMISS_KEY, '1');
    setShowRibbon(false);
  };

  return (
    <LocationProvider>
      <div className={`consumer-shell${showRibbon ? ' has-app-ribbon' : ''}`}>
        {showRibbon ? <AppDownloadRibbon onDismiss={dismissRibbon} /> : null}
        <TopNav />
        <MobileHeader />
        <StickySearch />
        <main className={`consumer-main${isHome ? ' consumer-main--home' : ''}`}>{children}</main>
        <Footer />
      </div>
    </LocationProvider>
  );
}
