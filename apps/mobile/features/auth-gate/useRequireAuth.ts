import { useAuth } from '@gloe/auth';
import { useCallback } from 'react';

import { useAuthGate } from './AuthGateProvider';
import type { AuthGateReason } from './types';

/**
 * Wraps an action so it runs immediately for signed-in users, and opens the
 * AuthGate sheet for anonymous users.
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   const onRedeem = requireAuth('redeem', () => { ...actually redeem... });
 *   <Button onPress={onRedeem} />
 */
export function useRequireAuth() {
  const { status } = useAuth();
  const { prompt } = useAuthGate();

  return useCallback(
    <Args extends unknown[]>(reason: AuthGateReason, action: (...args: Args) => void) => {
      return (...args: Args) => {
        if (status === 'signed-in') {
          action(...args);
        } else {
          prompt(reason);
        }
      };
    },
    [status, prompt],
  );
}
