'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Bookmark, Search, Sparkles, User, Wallet } from './icons';

/**
 * Fixed bottom tab bar — the mobile-web equivalent of the native app's tabs.
 * Saved/Wallet/Account only appear once signed in (they'd just bounce a
 * signed-out user to sign-in); signed-out shoppers get a Sign in tab instead.
 */
type Tab = { href: string; label: string; Icon: typeof Sparkles; match: (p: string) => boolean };

const DISCOVER: Tab = { href: '/', label: 'Discover', Icon: Sparkles, match: (p) => p === '/' };
const SEARCH: Tab = { href: '/search', label: 'Search', Icon: Search, match: (p) => p.startsWith('/search') };
const SAVED: Tab = { href: '/saved', label: 'Saved', Icon: Bookmark, match: (p) => p.startsWith('/saved') };
const WALLET: Tab = { href: '/wallet', label: 'Wallet', Icon: Wallet, match: (p) => p.startsWith('/wallet') };
const ACCOUNT: Tab = { href: '/account', label: 'Account', Icon: User, match: (p) => p.startsWith('/account') };
const SIGN_IN: Tab = { href: '/sign-in', label: 'Sign in', Icon: User, match: () => false };

export function MobileTabBar() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  const tabs: Tab[] = !isLoaded
    ? [DISCOVER, SEARCH]
    : isSignedIn
      ? [DISCOVER, SEARCH, SAVED, WALLET, ACCOUNT]
      : [DISCOVER, SEARCH, SIGN_IN];

  return (
    <nav className="mobile-tabbar show-mobile" aria-label="Primary">
      {tabs.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        const color = active ? 'var(--brand-600)' : 'var(--text-tertiary)';
        return (
          <Link
            key={href}
            href={href}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0', color, fontSize: 11, fontWeight: 600 }}
          >
            <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
