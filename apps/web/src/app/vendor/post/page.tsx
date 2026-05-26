'use client';

import { Suspense } from 'react';

import { PostDealForm } from './PostDealForm';

export default function PostDealPage() {
  return (
    <Suspense fallback={null}>
      <PostDealForm mode={{ kind: 'vendor' }} />
    </Suspense>
  );
}
