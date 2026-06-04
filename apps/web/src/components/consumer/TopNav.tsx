'use client';

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { Wordmark } from '../Wordmark';
import { LocationPill } from './LocationPill';
import { NavSearch } from './NavSearch';
import { useHeroHeader } from './useHeroHeader';
import { Bookmark, Wallet } from './icons';

/**
 * Desktop / tablet top navigation. Hidden below 760px (the MobileTabBar takes
 * over). Sticky, translucent, with the wordmark, a search affordance, location,
 * and account controls. "For Businesses" lives here too — quiet, top-right.
 */
export function TopNav() {
  const overHero = useHeroHeader();

  return (
    <header className={`topnav show-desktop${overHero ? ' over-hero' : ''}`}>
      <div className="topnav-inner">
        <Link href="/" aria-label="Gloē home" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Wordmark size={26} tone={overHero ? 'light' : 'gold'} />
        </Link>

        {/* The header search is redundant while the hero (with its own big
            search) is on screen — only show it once scrolled past the hero. */}
        {overHero ? <div style={{ flex: 1 }} /> : <NavSearch />}

        <nav className="topnav-links">
          <LocationPill />
          <SignedOut>
            <Link href="/sign-in" className="topnav-signin">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            {/* Saved + Wallet live inside the avatar menu now — keeps the header
                calm (just location · avatar · For Businesses). */}
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: 34, height: 34 } } }}>
              <UserButton.MenuItems>
                <UserButton.Link label="Wallet" labelIcon={<Wallet size={16} />} href="/wallet" />
                <UserButton.Link label="Saved" labelIcon={<Bookmark size={16} />} href="/saved" />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>
          <Link href="/business" className="topnav-biz">
            For Businesses
          </Link>
        </nav>
      </div>
    </header>
  );
}

