'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

import { trpc } from '../../lib/trpc';
import { useSignInModal } from './useSignInModal';

/**
 * Shared checkout actions for the deal page. "Buy now" → EMBEDDED Stripe
 * Checkout: we fetch a client secret and render the payment form in-page
 * (<EmbeddedCheckoutModal/>) so the buyer never leaves gloe.app. "Share to pay"
 * generates a gift link and opens the <SharePayModal/>. Signed-out shoppers are
 * routed to sign-in with a return path.
 */
export function useBuy() {
  const { isSignedIn } = useAuth();
  const openSignIn = useSignInModal();
  const embedded = trpc.checkout.createEmbeddedCheckout.useMutation();
  const gift = trpc.checkout.createGiftLink.useMutation();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  function requireAuth(): boolean {
    if (isSignedIn) return true;
    openSignIn();
    return false;
  }

  async function buy(variantId: string, quantity: number) {
    if (!requireAuth()) return;
    const res = await embedded.mutateAsync({ variantId, quantity });
    if (res.clientSecret) setClientSecret(res.clientSecret);
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
    /** When set, render <EmbeddedCheckoutModal clientSecret={...}/>. */
    checkoutSecret: clientSecret,
    closeCheckout: () => setClientSecret(null),
    loading: embedded.isPending,
    sharing: gift.isPending,
    error: embedded.error?.message ?? gift.error?.message ?? null,
  };
}
