'use client';

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

import { Wordmark } from '../Wordmark';
import { Bookmark, Search, Sparkles, User, Wallet, X } from './icons';
import { useHeroHeader } from './useHeroHeader';

/**
 * Website-style mobile top header (≤760px) — replaces the app-like bottom tab
 * bar so the mobile web reads as a real site (à la ResortPass): hamburger menu,
 * centered wordmark, search + account. Sticky to the top. Desktop keeps TopNav
 * (this is `show-mobile`, hidden above 760px).
 */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const overHero = useHeroHeader();
  // Over the hero image everything goes white to blend; after scroll it reverts
  // to the normal solid header (dark icons, gold wordmark).
  const iconColor = overHero ? '#fff' : 'var(--text-primary)';

  return (
    <>
      <header className={`mobile-header show-mobile${overHero ? ' over-hero' : ''}`}>
        {/* ResortPass layout: logo hard-left, hamburger + sign in on the right.
            Logo keeps its OG gold in both states. */}
        <Link href="/" aria-label="Gloē home" className="mh-logo" onClick={close}>
          <Wordmark size={22} tone="gold" />
        </Link>

        <div className="mh-right">
          <SignedOut>
            <Link href="/sign-in" className="mh-signin">Sign in</Link>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
          </SignedIn>
          <button type="button" className="mh-btn" aria-label="Menu" onClick={() => setOpen(true)}>
            <Hamburger color={iconColor} />
          </button>
        </div>
      </header>

      {open ? (
        <div className="mh-drawer-backdrop" onClick={close} role="dialog" aria-modal="true">
          <nav className="mh-drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="mh-drawer-head">
              <Wordmark size={22} tone="gold" />
              <button type="button" className="mh-btn" aria-label="Close menu" onClick={close}>
                <X size={22} color="var(--text-primary)" />
              </button>
            </div>

            <MenuLink href="/" label="Discover" Icon={Sparkles} onNavigate={close} />
            <MenuLink href="/search" label="Search" Icon={Search} onNavigate={close} />
            <MenuLink href="/saved" label="Saved" Icon={Bookmark} onNavigate={close} />
            <MenuLink href="/wallet" label="Wallet" Icon={Wallet} onNavigate={close} />
            <MenuLink href="/account" label="Account" Icon={User} onNavigate={close} />

            <div className="mh-drawer-sep" />

            <Link href="/business" className="mh-drawer-link" onClick={close} style={{ fontWeight: 500 }}>
              For Businesses
            </Link>
            <SignedOut>
              <Link href="/sign-in" className="mh-drawer-cta" onClick={close}>
                Sign in
              </Link>
            </SignedOut>
          </nav>
        </div>
      ) : null}
    </>
  );
}

function MenuLink({ href, label, Icon, onNavigate }: { href: string; label: string; Icon: typeof Sparkles; onNavigate: () => void }) {
  return (
    <Link href={href} className="mh-drawer-link" onClick={onNavigate}>
      <Icon size={20} color="var(--brand-600)" />
      {label}
    </Link>
  );
}

function Hamburger({ color = 'var(--text-primary)' }: { color?: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4.5, width: 20 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ height: 2, borderRadius: 2, background: color }} />
      ))}
    </span>
  );
}
