'use client';

import { useClerk } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { CLERK_APPEARANCE } from './clerkAppearance';

/**
 * Opens Clerk's sign-in as a slide-in modal over the current page instead of
 * navigating to the full /sign-in route. After auth the shopper stays put (or
 * lands on `redirectTo` when given — e.g. the Wallet menu item). Use everywhere
 * a signed-out shopper hits a gated action (buy, save, wallet, account).
 */
export function useSignInModal() {
  const { openSignIn } = useClerk();
  const pathname = usePathname();

  return useCallback(
    (redirectTo?: string) => {
      const dest = redirectTo ?? pathname;
      openSignIn({
        appearance: CLERK_APPEARANCE,
        forceRedirectUrl: dest,
        signUpForceRedirectUrl: dest,
      });
    },
    [openSignIn, pathname],
  );
}
