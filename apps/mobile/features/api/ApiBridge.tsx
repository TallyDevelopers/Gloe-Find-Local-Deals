import { useAuth } from '@clerk/clerk-expo';
import { TrpcProvider } from '@gloe/api-client';
import { useCallback, type ReactNode } from 'react';

import { getPendingReferralCode } from '../referral/pendingReferralCode';

interface ApiBridgeProps {
  apiUrl: string;
  children: ReactNode;
}

/**
 * Module-scoped (stable identity) so TrpcProvider's one-time client setup can
 * close over it safely. Reads the pending invite code fresh on every request —
 * the server attributes the referral when the new user row is JIT-created.
 */
function getExtraHeaders(): Record<string, string> {
  const code = getPendingReferralCode();
  return code ? { 'x-gloe-referral-code': code } : {};
}

/**
 * Connects the @gloe/api-client to Clerk for auth. We can't import Clerk into
 * the api-client package directly (it's a generic package), so this thin
 * bridge lives in the mobile app and passes a getToken closure into TrpcProvider.
 */
export function ApiBridge({ apiUrl, children }: ApiBridgeProps) {
  const { getToken } = useAuth();

  const getTokenAsync = useCallback(async () => {
    try {
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken]);

  return (
    <TrpcProvider apiUrl={apiUrl} getToken={getTokenAsync} getExtraHeaders={getExtraHeaders}>
      {children}
    </TrpcProvider>
  );
}
