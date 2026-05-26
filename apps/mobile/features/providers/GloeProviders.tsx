import { AuthProvider } from '@gloe/auth';
import { StripeProvider } from '@stripe/stripe-react-native';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiBridge } from '../api/ApiBridge';
import { AuthGateProvider } from '../auth-gate/AuthGateProvider';
import { ClaimedDealsProvider } from '../claimed/ClaimedDealsProvider';
import { SelectedLocationProvider } from '../discover-header/SelectedLocationProvider';
import { SavedDealsProvider } from '../saved/SavedDealsProvider';
import { SavedVendorsProvider } from '../saved/SavedVendorsProvider';
import { ThemePreferenceProvider } from '../theme/ThemePreferenceProvider';

interface GloeProvidersProps {
  clerkPublishableKey: string;
  stripePublishableKey: string;
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
export function GloeProviders({
  clerkPublishableKey,
  stripePublishableKey,
  apiUrl,
  children,
}: GloeProvidersProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <StripeProvider publishableKey={stripePublishableKey} merchantIdentifier="merchant.com.gloe.app">
          <AuthProvider publishableKey={clerkPublishableKey}>
            <ApiBridge apiUrl={apiUrl}>
              <AuthGateProvider>
                <SelectedLocationProvider>
                  <SavedDealsProvider>
                    <SavedVendorsProvider>
                      <ClaimedDealsProvider>{children}</ClaimedDealsProvider>
                    </SavedVendorsProvider>
                  </SavedDealsProvider>
                </SelectedLocationProvider>
              </AuthGateProvider>
            </ApiBridge>
            </AuthProvider>
          </StripeProvider>
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
