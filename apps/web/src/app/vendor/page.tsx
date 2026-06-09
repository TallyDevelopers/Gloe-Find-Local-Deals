'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
    return <ClaimOrSignup onVendorReady={() => meQuery.refetch()} />;
  }

  return <VendorDashboard vendor={meQuery.data} />;
}

/**
 * GLO-5: before showing the signup form to a vendor-less user, try to claim
 * an admin-pre-created vendor whose email matches their verified Clerk email.
 * An invited owner therefore lands straight in their own dashboard — they
 * never see the signup form, and never create a duplicate vendor.
 */
function ClaimOrSignup({ onVendorReady }: { onVendorReady: () => void }) {
  const claim = trpc.vendor.claimByEmail.useMutation();
  const [checked, setChecked] = useState(false);
  const [manualResult, setManualResult] = useState<string | null>(null);
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    claim
      .mutateAsync()
      .then((r) => {
        if (r.claimed) onVendorReady();
        else setChecked(true);
      })
      .catch(() => setChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) {
    return <CenteredMessage>Checking for your business…</CenteredMessage>;
  }

  const manualClaim = async () => {
    setManualResult(null);
    try {
      const r = await claim.mutateAsync();
      if (r.claimed) onVendorReady();
      else {
        setManualResult(
          'No business matches your verified email. Ask your Gloē contact to add this email to your listing, then try again.',
        );
      }
    } catch {
      setManualResult('Something went wrong — try again in a minute.');
    }
  };

  return (
    <div>
      <div
        style={{
          maxWidth: 560,
          margin: '20px auto 0',
          padding: '12px 16px',
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-100)',
          borderRadius: 'var(--radius-md)',
          fontSize: 14,
          color: 'var(--text-secondary)',
        }}
      >
        <strong>Was your spa set up for you?</strong> If Gloē created your listing, you don&rsquo;t
        need this form — sign in with the email we have on file and{' '}
        <button
          onClick={manualClaim}
          disabled={claim.isPending}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--brand-600)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {claim.isPending ? 'checking…' : 'claim your business'}
        </button>
        .
        {manualResult ? (
          <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 13 }}>{manualResult}</div>
        ) : null}
      </div>
      <VendorSignupForm onCreated={onVendorReady} />
    </div>
  );
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
