import type { ReactNode } from 'react';

import { usePushRegistration } from './usePushRegistration';

/**
 * Thin bridge so the push-registration effect runs inside the auth+API
 * provider tree without forcing each consumer screen to mount it. Must be a
 * descendant of <ApiBridge> (needs trpc) and <AuthProvider> (reads sign-in).
 */
export function PushRegistrationBridge({ children }: { children: ReactNode }) {
  usePushRegistration();
  return <>{children}</>;
}
