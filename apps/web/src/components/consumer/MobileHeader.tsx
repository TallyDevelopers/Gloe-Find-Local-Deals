'use client';

import { SignedIn, SignedOut, UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

import { Wordmark } from '../Wordmark';
import { Bookmark, Search, Sparkles, User, Wallet, X } from './icons';
import { useHeroHeader } from './useHeroHeader';
import { useSignInModal } from './useSignInModal';

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
  const { isSignedIn } = useAuth();
  const openSignIn = useSignInModal();
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
            <button type="button" className="mh-signin" onClick={() => openSignIn()}>Sign in</button>
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
            <MenuLink href="/saved" label="Saved" Icon={Bookmark} onNavigate={close} gated={!isSignedIn} onGated={openSignIn} />
            <MenuLink href="/wallet" label="Wallet" Icon={Wallet} onNavigate={close} gated={!isSignedIn} onGated={openSignIn} />
            <MenuLink href="/account" label="Account" Icon={User} onNavigate={close} gated={!isSignedIn} onGated={openSignIn} />

            <div className="mh-drawer-sep" />

            <Link href="/business" className="mh-drawer-link" onClick={close} style={{ fontWeight: 500 }}>
              For Businesses
            </Link>
            <SignedOut>
              <button type="button" className="mh-drawer-cta" onClick={() => { close(); openSignIn(); }}>
                Sign in
              </button>
            </SignedOut>
          </nav>
        </div>
      ) : null}
    </>
  );
}

function MenuLink({
  href,
  label,
  Icon,
  onNavigate,
  gated = false,
  onGated,
}: {
  href: string;
  label: string;
  Icon: typeof Sparkles;
  onNavigate: () => void;
  /** When true (signed-out + account-gated link), open sign-in instead of navigating. */
  gated?: boolean;
  /** Opens the sign-in modal, returning to `href` after auth. */
  onGated?: (redirectTo: string) => void;
}) {
  if (gated && onGated) {
    return (
      <button
        type="button"
        className="mh-drawer-link"
        onClick={() => {
          onNavigate();
          onGated(href);
        }}
      >
        <Icon size={20} color="var(--brand-600)" />
        {label}
      </button>
    );
  }
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
        <span key={i} style={{ height: 2, borderRadius: 2, background: color, transition: 'background-color 0.25s ease' }} />
      ))}
    </span>
  );
}
