'use client';

import { trpc } from '../../lib/trpc';
import { VendorDashboard } from './VendorDashboard';
import { VendorSignupForm } from './VendorSignupForm';

/**
 * Vendor home. Routes between signup (no vendor record yet) and dashboard
 * (already a vendor). One URL, two states.
 */
export default function VendorPage() {
  const meQuery = trpc.vendor.me.useQuery();

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
