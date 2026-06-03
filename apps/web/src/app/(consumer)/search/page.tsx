'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { SearchPanel } from '../../../components/consumer/SearchPanel';
import { DealGridSkeleton } from '../../../components/consumer/Skeletons';

function SearchInner() {
  const params = useSearchParams();
  return <SearchPanel initialQuery={params.get('q') ?? ''} syncUrl />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="consumer-container" style={{ paddingTop: 24 }}><DealGridSkeleton count={8} /></div>}>
      <SearchInner />
    </Suspense>
  );
}
