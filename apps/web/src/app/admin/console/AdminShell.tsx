'use client';

import { UserButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

import { Wordmark } from '../../../components/Wordmark';
import { trpc } from '../../../lib/trpc';
import { AuditView } from './AuditView';
import { CommandPalette } from './CommandPalette';
import { CustomersView } from './CustomersView';
import { FeesView } from './FeesView';
import { PayoutsView } from './PayoutsView';
import { PulseView } from './PulseView';
import { SettingsView } from './SettingsView';
import { SupportView } from './SupportView';
import { TransactionsView } from './TransactionsView';
import { VendorsView } from './VendorsView';
import { WaitlistView } from './WaitlistView';

type WorkspaceView =
  | 'pulse' | 'transactions' | 'vendors' | 'customers'
  | 'payouts' | 'fees' | 'support' | 'waitlist' | 'audit' | 'settings';

const NAV: { key: WorkspaceView; label: string; icon: string; badgeFor?: 'failed_payouts' | 'pending_deals' }[] = [
  { key: 'pulse',        label: 'Pulse',        icon: '◐' },
  { key: 'transactions', label: 'Transactions', icon: '$' },
  { key: 'vendors',      label: 'Vendors',      icon: '▣' },
  { key: 'customers',    label: 'Customers',    icon: '☻' },
  { key: 'payouts',      label: 'Payouts',      icon: '↗', badgeFor: 'failed_payouts' },
  { key: 'fees',         label: 'Fees',         icon: '%' },
  { key: 'support',      label: 'Support',      icon: '💬' },
  { key: 'waitlist',     label: 'Waitlist',     icon: '⋆' },
  { key: 'audit',        label: 'Audit',        icon: '☐' },
  { key: 'settings',     label: 'Settings',     icon: '⚙', badgeFor: 'pending_deals' },
];

export function AdminShell() {
  const [view, setView] = useState<WorkspaceView>('pulse');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // When TransactionsView wants to jump to a specific customer, it sets this
  // and we switch tabs. CustomersView opens the drawer for the matching id.
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);

  const jumpToCustomer = (customerId: string) => {
    setPreselectedCustomerId(customerId);
    setView('customers');
    setMobileNavOpen(false);
  };

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

  const navigate = (next: WorkspaceView) => {
    setMobileNavOpen(false);
    setView(next);
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
            const active = view === n.key;
            const badge = badgeValue(n.badgeFor, pulse.data);
            return (
              <button
                key={n.key}
                onClick={() => navigate(n.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: active ? 'var(--brand-500)' : 'transparent',
                  color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 18, textAlign: 'center', opacity: 0.9 }}>{n.icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {badge != null && badge > 0 ? (
                  <span style={{
                    minWidth: 22, padding: '0 7px',
                    background: active ? 'rgba(255,255,255,0.25)' : (n.key === 'settings' ? 'var(--brand-500)' : 'var(--error)'),
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

        <main style={mainStyle}>
          {view === 'pulse'        ? <PulseView onNavigate={(v) => navigate(v)} /> : null}
          {view === 'transactions' ? <TransactionsView onJumpToCustomer={jumpToCustomer} /> : null}
          {view === 'vendors'      ? <VendorsView /> : null}
          {view === 'customers'    ? <CustomersView preselectedId={preselectedCustomerId} onPreselectionConsumed={() => setPreselectedCustomerId(null)} /> : null}
          {view === 'payouts'      ? <PayoutsView /> : null}
          {view === 'fees'         ? <FeesView /> : null}
          {view === 'support'      ? <SupportView /> : null}
          {view === 'waitlist'     ? <WaitlistView /> : null}
          {view === 'audit'        ? <AuditView /> : null}
          {view === 'settings'     ? <SettingsView /> : null}
        </main>
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
