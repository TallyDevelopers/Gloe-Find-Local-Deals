'use client';

import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { trpc } from '../../lib/trpc';

/**
 * Shared checkout actions for the deal page (used by both the desktop purchase
 * panel and the mobile sticky bar). "Buy now" → hosted Stripe Checkout. "Share
 * to pay" generates a gift link and opens the <SharePayModal/> (which adapts to
 * the device — native share sheet vs. copy/Text/Email). Signed-out shoppers are
 * routed to sign-in with a return path.
 */
export function useBuy() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hosted = trpc.checkout.createHostedCheckout.useMutation();
  const gift = trpc.checkout.createGiftLink.useMutation();
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  function requireAuth(): boolean {
    if (isSignedIn) return true;
    router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
    return false;
  }

  async function buy(variantId: string, quantity: number) {
    if (!requireAuth()) return;
    const res = await hosted.mutateAsync({ variantId, quantity });
    window.location.href = res.checkoutUrl;
  }

  async function startShare(variantId: string, quantity: number) {
    if (!requireAuth()) return;
    const res = await gift.mutateAsync({ variantId, quantity });
    setShareUrl(res.giftUrl);
  }

  return {
    buy,
    startShare,
    shareUrl,
    closeShare: () => setShareUrl(null),
    loading: hosted.isPending,
    sharing: gift.isPending,
    error: hosted.error?.message ?? gift.error?.message ?? null,
  };
}
