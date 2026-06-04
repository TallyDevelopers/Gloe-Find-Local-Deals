'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { trpc } from '../../lib/trpc';
import { AdminShell } from './console/AdminShell';

/**
 * Founder console. Gated to admins; non-admins get bounced to /vendor.
 * Renders the modular console (sidebar + workspace + ⌘K).
 */
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
    <Suspense fallback={null}>
      <AdminShell />
    </Suspense>
  );
}
