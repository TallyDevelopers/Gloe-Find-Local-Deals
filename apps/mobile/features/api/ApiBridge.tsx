import { useAuth } from '@clerk/clerk-expo';
import { TrpcProvider } from '@gloe/api-client';
import { useCallback, type ReactNode } from 'react';

interface ApiBridgeProps {
  apiUrl: string;
  children: ReactNode;
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
    <TrpcProvider apiUrl={apiUrl} getToken={getTokenAsync}>
      {children}
    </TrpcProvider>
  );
}
