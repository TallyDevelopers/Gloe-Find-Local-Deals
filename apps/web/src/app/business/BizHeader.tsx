'use client';

import { SignedIn, SignedOut } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Wordmark } from '../../components/Wordmark';

/**
 * /business sticky header with the consumer TopNav's "liquid glass" behavior:
 * fully transparent while it floats over the dark hero, then frosted ink as
 * you scroll. Metrics match .topnav-inner (1600 / 68 / 40px gutters) so the
 * wordmark doesn't jump when flipping between gloe.app and here.
 */
export function BizHeader() {
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    // Same 120px threshold as useHeroHeader — flip while still over the hero.
    const onScroll = () => setAtTop(window.scrollY < 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        // Same mechanic as .topnav.over-hero: absolute (zero flow space) while
        // over the hero so the dark band runs to the very top of the screen,
        // sticky + frosted once scrolled.
        position: atTop ? 'absolute' : 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: atTop ? 'transparent' : 'rgba(19,18,23,0.85)',
        backdropFilter: atTop ? 'none' : 'saturate(140%) blur(14px)',
        WebkitBackdropFilter: atTop ? 'none' : 'saturate(140%) blur(14px)',
        borderBottom: atTop ? '1px solid transparent' : '1px solid rgba(240,237,241,0.1)',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}
    >
      <div style={{ maxWidth: 1600, margin: '0 auto', height: 68, padding: '0 clamp(20px, 4vw, 40px)', display: 'flex', alignItems: 'center', gap: 22 }}>
        <Link href="/" aria-label="Gloē home" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12 }}>
          <Wordmark size={26} tone="gold" />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: '#857f89' }}>FOR BUSINESS</span>
        </Link>
        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="#how" className="bl-nav-link show-desktop-inline">How it works</a>
          <a href="#pricing" className="bl-nav-link show-desktop-inline">Pricing</a>
          <a href="#faq" className="bl-nav-link show-desktop-inline">FAQ</a>
          <SignedOut>
            <Link href="/sign-in?redirect_url=/vendor" className="bl-nav-link">Sign in</Link>
            <Link href="/sign-up?redirect_url=/vendor" className="bl-header-cta">List your spa</Link>
          </SignedOut>
          <SignedIn>
            <Link href="/vendor" className="bl-header-cta">Go to dashboard</Link>
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
