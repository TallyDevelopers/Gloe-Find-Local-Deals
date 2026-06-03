'use client';

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
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
          <SignedIn>
            <NavLink href="/saved" active={pathname === '/saved'}>
              <Bookmark size={18} /> Saved
            </NavLink>
            <NavLink href="/wallet" active={pathname.startsWith('/wallet')}>
              <Wallet size={18} /> Wallet
            </NavLink>
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="topnav-signin">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: 34, height: 34 } } }} />
          </SignedIn>
          <Link href="/business" className="topnav-biz">
            For Businesses
          </Link>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 15,
        fontWeight: 600,
        padding: '8px 12px',
        borderRadius: 'var(--radius-pill)',
        color: active ? 'var(--brand-600)' : 'var(--text-secondary)',
        background: active ? 'var(--brand-50)' : 'transparent',
      }}
    >
      {children}
    </Link>
  );
}
