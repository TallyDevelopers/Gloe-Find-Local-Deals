'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

import { SignInGate } from '../../../components/consumer/SignInGate';
import { Bookmark, ChevronRight, Globe, Sparkles, Wallet } from '../../../components/consumer/icons';
import { trpc } from '../../../lib/trpc';

export default function AccountPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const me = trpc.me.whoami.useQuery(undefined, { enabled: !!isSignedIn });
  const del = trpc.me.deleteAccount.useMutation();
  const [confirming, setConfirming] = useState(false);

  if (isLoaded && !isSignedIn) {
    return <SignInGate title="Your account" subtitle="Sign in to manage your profile, deals, and vouchers." />;
  }

  const u = me.data;
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Welcome';
  const initial = (u?.firstName?.[0] ?? u?.email?.[0] ?? 'G').toUpperCase();

  async function handleDelete() {
    await del.mutateAsync();
    await signOut({ redirectUrl: '/' });
  }

  return (
    <div className="consumer-container" style={{ maxWidth: 620, paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>Account</h1>

      {/* Profile card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, padding: 20, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        {u?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.imageUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-500)', color: 'var(--text-inverse)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {initial}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>{name}</div>
          {u?.email ? <div style={{ color: 'var(--text-tertiary)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div> : null}
        </div>
      </div>

      {/* Links */}
      <div style={{ marginTop: 20, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <Row href="/wallet" icon={<Wallet size={18} color="var(--brand-600)" />} label="Your vouchers" />
        <Row href="/saved" icon={<Bookmark size={18} color="var(--brand-600)" />} label="Saved deals & spas" />
        <Row href="/support" icon={<Sparkles size={18} color="var(--brand-600)" />} label="Concierge / Support" />
        <Row href="/business" icon={<Globe size={18} color="var(--brand-600)" />} label="For Businesses" />
      </div>

      <div style={{ marginTop: 20, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <Row href="/legal/terms" label="Terms of service" />
        <Row href="/legal/privacy" label="Privacy policy" />
      </div>

      {/* Account actions */}
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: '/' })}
          style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 15, padding: '6px 0' }}
        >
          Sign out
        </button>

        {confirming ? (
          <div style={{ padding: 16, border: '1px solid var(--error)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>This permanently deletes your account and data. This can’t be undone.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={handleDelete} disabled={del.isPending} style={{ background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', padding: '10px 18px', fontWeight: 600 }}>
                {del.isPending ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button type="button" onClick={() => setConfirming(false)} style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '10px 18px', fontWeight: 600 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--error)', fontWeight: 600, fontSize: 14, padding: '6px 0' }}>
            Delete account
          </button>
        )}
      </div>

      <p style={{ marginTop: 28, fontSize: 12.5, color: 'var(--text-tertiary)' }}>Gloē · v0.0.1</p>
    </div>
  );
}

function Row({ href, icon, label }: { href: string; icon?: React.ReactNode; label: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
      {icon ? <span style={{ display: 'inline-flex' }}>{icon}</span> : null}
      <span style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
      <span style={{ marginLeft: 'auto' }}><ChevronRight size={18} color="var(--text-tertiary)" /></span>
    </Link>
  );
}
