import { AuthProvider } from '@gloe/auth';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiBridge } from '../api/ApiBridge';
import { AuthGateProvider } from '../auth-gate/AuthGateProvider';
import { ClaimedDealsProvider } from '../claimed/ClaimedDealsProvider';
import { SavedDealsProvider } from '../saved/SavedDealsProvider';

interface GloeProvidersProps {
  clerkPublishableKey: string;
  apiUrl: string;
  children: ReactNode;
}

/**
 * Single composed provider for the entire app.
 *
 * Order matters:
 * - SafeAreaProvider must be outermost (some children read insets)
 * - AuthProvider must come before ApiBridge (ApiBridge reads Clerk's getToken)
 * - SavedDealsProvider + ClaimedDealsProvider depend on the API client + auth
 * - AuthGateProvider needs to be in scope for the auth-required actions inside
 *   the saved/claimed providers
 *
 * Add new providers here. Don't nest them inline in _layout.tsx — every
 * additional level there makes the tree harder to read.
 */
export function GloeProviders({ clerkPublishableKey, apiUrl, children }: GloeProvidersProps) {
  return (
    <SafeAreaProvider>
      <AuthProvider publishableKey={clerkPublishableKey}>
        <ApiBridge apiUrl={apiUrl}>
          <AuthGateProvider>
            <SavedDealsProvider>
              <ClaimedDealsProvider>{children}</ClaimedDealsProvider>
            </SavedDealsProvider>
          </AuthGateProvider>
        </ApiBridge>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
