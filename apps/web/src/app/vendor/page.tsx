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
  const [checking, setChecking] = useState(false);
  const [manualResult, setManualResult] = useState<string | null>(null);
  const ranOnce = useRef(false);

  // A stale Clerk session can stall token refresh and leave the request
  // in-flight forever — cap every claim check so the UI can't hang on
  // "Checking…" indefinitely.
  const claimWithTimeout = () =>
    Promise.race([
      claim.mutateAsync(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('claim-timeout')), 15_000)),
    ]);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    claimWithTimeout()
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
    setChecking(true);
    try {
      const r = await claimWithTimeout();
      if (r.claimed) onVendorReady();
      else {
        setManualResult(
          'No business matches your verified email. Ask your Gloē contact to add this email to your listing, then try again.',
        );
      }
    } catch (e) {
      setManualResult(
        e instanceof Error && e.message === 'claim-timeout'
          ? 'That took too long — reload the page and try again.'
          : 'Something went wrong — try again in a minute.',
      );
    } finally {
      setChecking(false);
    }
  };

  // Auto-claim already ran and found nothing, so for almost everyone this
  // form is correct. The footnote covers the one edge case: their listing
  // exists but the admin added their email AFTER the auto-check above.
  return (
    <VendorSignupForm
      onCreated={onVendorReady}
      footnote={
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            lineHeight: 1.5,
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 18,
          }}
        >
          Expecting to see a listing Gloē set up for you?{' '}
          <button onClick={manualClaim} disabled={checking} className="biz-claim-link">
            {checking ? 'Checking…' : 'Check again'}
          </button>
          {manualResult ? (
            <span style={{ display: 'block', marginTop: 6 }}>{manualResult}</span>
          ) : null}
        </p>
      }
    />
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
