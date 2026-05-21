'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { trpc } from '../../lib/trpc';
import { VendorDashboard } from './VendorDashboard';
import { VendorSignupForm } from './VendorSignupForm';

/**
 * Vendor home. Same login as admin: an admin gets redirected to the founder
 * console; everyone else routes between vendor signup and dashboard.
 */
export default function VendorPage() {
  const router = useRouter();
  const whoamiQuery = trpc.admin.whoami.useQuery();
  const isAdmin = whoamiQuery.data?.isAdmin ?? false;
  const meQuery = trpc.vendor.me.useQuery(undefined, { enabled: !whoamiQuery.isLoading && !isAdmin });

  useEffect(() => {
    if (isAdmin) router.replace('/admin');
  }, [isAdmin, router]);

  if (whoamiQuery.isLoading || isAdmin) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (meQuery.isLoading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (meQuery.isError) {
    return <CenteredMessage>Something went wrong. Refresh the page.</CenteredMessage>;
  }

  if (!meQuery.data) {
    return <VendorSignupForm onCreated={() => meQuery.refetch()} />;
  }

  return <VendorDashboard vendor={meQuery.data} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </main>
  );
}
