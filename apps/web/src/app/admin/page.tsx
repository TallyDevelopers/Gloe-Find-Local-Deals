'use client';

import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Wordmark } from '../../components/Wordmark';
import { trpc } from '../../lib/trpc';
import { AdminDashboard } from './AdminDashboard';

/** Founder console. Gated to admins; non-admins get bounced to /vendor. */
export default function AdminPage() {
  const router = useRouter();
  const whoami = trpc.admin.whoami.useQuery();

  useEffect(() => {
    if (whoami.data && !whoami.data.isAdmin) router.replace('/vendor');
  }, [whoami.data, router]);

  if (whoami.isLoading || !whoami.data?.isAdmin) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading…
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Wordmark size={24} tone="gold" />
            <span style={{ fontSize: 12, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>GOD MODE</span>
          </div>
          <UserButton />
        </div>
      </header>
      <AdminDashboard />
    </div>
  );
}
