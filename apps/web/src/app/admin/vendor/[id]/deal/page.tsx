'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import { trpc } from '../../../../../lib/trpc';
import { PostDealForm } from '../../../../vendor/post/PostDealForm';

/**
 * Founder posts a deal on any spa's behalf — same form + live iPhone preview
 * the vendor sees, wired to post on their behalf (live immediately).
 */
export default function OnBehalfDealPage() {
  const { id } = useParams<{ id: string }>();
  const detail = trpc.admin.vendorDetail.useQuery({ vendorId: id });
  const vendorName = detail.data?.vendor.businessName;

  if (!vendorName) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading…
      </main>
    );
  }

  return (
    <Suspense fallback={null}>
      <PostDealForm mode={{ kind: 'admin', vendorId: id, vendorName }} />
    </Suspense>
  );
}
