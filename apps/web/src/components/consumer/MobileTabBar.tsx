'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Bookmark, Search, Sparkles, User, Wallet } from './icons';

/**
 * Fixed bottom tab bar — the mobile-web equivalent of the native app's tabs.
 * Shown only below 760px (CSS class .show-mobile). Mirrors the app: Discover,
 * Search, Saved, Wallet, Account.
 */
const TABS = [
  { href: '/', label: 'Discover', Icon: Sparkles, match: (p: string) => p === '/' },
  { href: '/search', label: 'Search', Icon: Search, match: (p: string) => p.startsWith('/search') },
  { href: '/saved', label: 'Saved', Icon: Bookmark, match: (p: string) => p.startsWith('/saved') },
  { href: '/wallet', label: 'Wallet', Icon: Wallet, match: (p: string) => p.startsWith('/wallet') },
  { href: '/account', label: 'Account', Icon: User, match: (p: string) => p.startsWith('/account') },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="mobile-tabbar show-mobile" aria-label="Primary">
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        const color = active ? 'var(--brand-600)' : 'var(--text-tertiary)';
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 0',
              color,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
