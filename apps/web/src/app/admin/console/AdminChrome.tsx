'use client';

import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Wordmark } from '../../../components/Wordmark';
import { trpc } from '../../../lib/trpc';
import { CommandPalette } from './CommandPalette';

export type WorkspaceView =
  | 'pulse' | 'transactions' | 'vendors' | 'customers'
  | 'payouts' | 'refunds' | 'fees' | 'credits' | 'promos' | 'support' | 'sections' | 'taxonomy' | 'waitlist' | 'audit' | 'admins' | 'settings';

const NAV: { key: WorkspaceView; label: string; badgeFor?: 'failed_payouts' | 'pending_deals' }[] = [
  { key: 'pulse',        label: 'Pulse' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'vendors',      label: 'Vendors' },
  { key: 'customers',    label: 'Customers' },
  { key: 'payouts',      label: 'Payouts', badgeFor: 'failed_payouts' },
  { key: 'refunds',      label: 'Refunds' },
  { key: 'fees',         label: 'Fees' },
  { key: 'credits',      label: 'Credits' },
  { key: 'promos',       label: 'Promos' },
  { key: 'support',      label: 'Support' },
  { key: 'sections',     label: 'Discover' },
  { key: 'taxonomy',     label: 'Treatments' },
  { key: 'waitlist',     label: 'Waitlist' },
  { key: 'audit',        label: 'Audit' },
  { key: 'admins',       label: 'Admins' },
  { key: 'settings',     label: 'Settings', badgeFor: 'pending_deals' },
];

/** Clean inline SVG nav icons (Lucide geometry), keyed by view. currentColor so
 *  they inherit the active/inactive text color. Replaces the old Unicode glyphs. */
function NavIcon({ name }: { name: WorkspaceView }) {
  const p = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'pulse':
      return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case 'transactions':
      return <svg {...p}><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>;
    case 'vendors':
      return <svg {...p}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01M15 10h.01" /></svg>;
    case 'customers':
      return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'payouts':
      return <svg {...p}><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>;
    case 'refunds':
      return <svg {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a6 6 0 0 1 0 12h-3" /></svg>;
    case 'fees':
      return <svg {...p}><line x1="19" x2="5" y1="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>;
    case 'credits':
      // Wallet glyph — the customer credit balance program.
      return <svg {...p}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></svg>;
    case 'promos':
      // Price-tag glyph — discounts placed on deals.
      return <svg {...p}><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>;
    case 'support':
      return <svg {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
    case 'waitlist':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'audit':
      return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></svg>;
    case 'admins':
      return <svg {...p}><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" /></svg>;
    case 'settings':
      return <svg {...p}><path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" /></svg>;
    case 'sections':
      // Layout/grid glyph — editorial merchandising rails.
      return <svg {...p}><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>;
    case 'taxonomy':
      // List-tree glyph — categories with treatments nested under them.
      return <svg {...p}><path d="M21 12h-8" /><path d="M21 6H8" /><path d="M21 18h-8" /><path d="M3 6v4c0 1.1.9 2 2 2h3" /><path d="M3 10v6c0 1.1.9 2 2 2h3" /></svg>;
  }
}

/**
 * The persistent admin shell chrome: top bar (wordmark + ⌘K search + account)
 * and the left nav rail. Rendered on EVERY admin page — the console and all its
 * sub-pages (vendor detail, post-a-deal, add-a-spa) — so the nav never vanishes.
 *
 * Two navigation modes:
 *  - Console: pass `onNavigate` and the in-page view switches instantly (no route
 *    change), preserving cross-view jump state.
 *  - Sub-pages: omit `onNavigate`; clicking a tab routes to `/admin?tab=<key>`.
 */
export function AdminChrome({
  active,
  onNavigate,
  children,
}: {
  active?: WorkspaceView | null;
  onNavigate?: (v: WorkspaceView) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pulse = trpc.admin.pulse.useQuery(undefined, { refetchInterval: 15_000 });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === '/' && !isTypingInInput(e.target)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const go = (next: WorkspaceView) => {
    setMobileNavOpen(false);
    if (onNavigate) onNavigate(next);
    else router.push(`/admin?tab=${next}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-default)' }}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Menu"
            className="admin-hamburger"
            style={hamburger}
          >
            ☰
          </button>
          <Wordmark size={22} tone="gold" />
          <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>GOD MODE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPaletteOpen(true)} style={searchBtn}>
            <span>⌕</span>
            <span className="admin-search-label">Search</span>
            <kbd style={kbd}>⌘K</kbd>
          </button>
          <UserButton />
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <aside
          className={`admin-sidebar-nav ${mobileNavOpen ? 'open' : ''}`}
          style={sidebar}
        >
          {NAV.map((n) => {
            const isActive = active === n.key;
            const badge = badgeValue(n.badgeFor, pulse.data);
            return (
              <button
                key={n.key}
                onClick={() => go(n.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isActive ? 'var(--brand-500)' : 'transparent',
                  color: isActive ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.95 }}>
                  <NavIcon name={n.key} />
                </span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {badge != null && badge > 0 ? (
                  <span style={{
                    minWidth: 22, padding: '0 7px',
                    background: isActive ? 'rgba(255,255,255,0.25)' : (n.key === 'settings' ? 'var(--brand-500)' : 'var(--error)'),
                    color: '#fff', fontSize: 11, fontWeight: 700,
                    borderRadius: 999,
                    textAlign: 'center',
                  }}>{badge}</span>
                ) : null}
              </button>
            );
          })}
        </aside>

        {mobileNavOpen ? (
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.4)', zIndex: 40 }}
          />
        ) : null}

        <main style={mainStyle}>{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <style jsx>{`
        :global(.admin-hamburger) { display: none; }
        @media (max-width: 720px) {
          :global(.admin-hamburger) {
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
          }
          :global(.admin-sidebar-nav) {
            position: fixed !important;
            left: 0;
            top: 56px;
            bottom: 0;
            transform: translateX(-100%);
            transition: transform 160ms ease-out;
            z-index: 41;
            box-shadow: 6px 0 24px rgba(0,0,0,0.18);
          }
          :global(.admin-sidebar-nav.open) {
            transform: translateX(0);
          }
          :global(.admin-search-label) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

function badgeValue(
  key: 'failed_payouts' | 'pending_deals' | undefined,
  pulse: { failed_payouts: number; pending_deals: number } | undefined,
): number | null {
  if (!key || !pulse) return null;
  return pulse[key] ?? 0;
}

function isTypingInInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 18px',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--surface-elevated)',
  position: 'sticky', top: 0, zIndex: 50,
};
const sidebar: React.CSSProperties = {
  width: 220, flexShrink: 0,
  borderRight: '1px solid var(--border-subtle)',
  background: 'var(--surface-elevated)',
  padding: 12,
  display: 'flex', flexDirection: 'column', gap: 4,
};
const mainStyle: React.CSSProperties = {
  flex: 1, padding: 24, minWidth: 0,
};
const hamburger: React.CSSProperties = {
  background: 'none', border: 'none',
  fontSize: 20, color: 'var(--text-primary)',
  padding: '4px 8px',
  cursor: 'pointer',
  display: 'none',
};
const searchBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 12px',
  fontSize: 13,
  background: 'var(--surface-default)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 999,
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
};
const kbd: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  padding: '1px 5px',
  borderRadius: 3,
  background: 'var(--surface-secondary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-tertiary)',
};
