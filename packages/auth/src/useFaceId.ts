import { useSignIn } from '@clerk/clerk-expo';
import { useState } from 'react';

import type { AuthError } from './types';

interface FaceIdFlow {
  /** True once the device has stored credentials AND supports biometrics. */
  available: boolean;
  /** 'face-recognition' | 'fingerprint' | null — drives the button label. */
  biometricType: 'face-recognition' | 'fingerprint' | null;
  /** Prompt Face ID / Touch ID and sign the user in. */
  authenticate: () => Promise<{ success: boolean }>;
  /** Store the just-used email+password so next time Face ID works. Call after
   *  a successful password sign-in. */
  remember: (identifier: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: AuthError | null;
  reset: () => void;
}

/**
 * Clerk's local-credentials hook lives behind a NATIVE module
 * (expo-local-authentication). On a JS bundle running against a build that
 * doesn't include that native module (e.g. a simulator/dev build that wasn't
 * rebuilt after the dep was added), importing it throws at load time and bricks
 * the whole app. We require it defensively so a missing module just disables
 * Face ID instead of crashing. (eslint/ts: dynamic require is intentional.)
 */
let useLocalCredentials:
  | (() => {
      authenticate: () => Promise<{ status: string | null; createdSessionId: string | null }>;
      setCredentials: (c: { identifier: string; password: string }) => Promise<void>;
      hasCredentials: boolean;
      biometricType: 'face-recognition' | 'fingerprint' | null;
    })
  | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useLocalCredentials = require('@clerk/clerk-expo/local-credentials').useLocalCredentials;
} catch {
  useLocalCredentials = null;
}

const NOOP_FLOW: FaceIdFlow = {
  available: false,
  biometricType: null,
  authenticate: async () => ({ success: false }),
  remember: async () => {},
  isLoading: false,
  error: null,
  reset: () => {},
};

/**
 * Biometric (Face ID / Touch ID) sign-in via Clerk's `useLocalCredentials`.
 * Clerk securely stores the identifier+password in the device keychain and
 * unlocks them behind a biometric prompt. If the native module isn't present in
 * the current build, returns an inert flow (`available: false`) so callers can
 * just hide the Face ID button — the app never crashes over it.
 *
 * Requires `expo-local-authentication` + `expo-secure-store` in the native build.
 */
export function useFaceId(): FaceIdFlow {
  // Always call hooks unconditionally. When the native module is missing,
  // `useLocalCredentials` is null and we fall back to the inert flow AFTER hooks.
  const { setActive } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const creds = useLocalCredentials ? useLocalCredentials() : null;

  if (!creds) return NOOP_FLOW;

  const { authenticate, setCredentials, hasCredentials, biometricType } = creds;

  return {
    available: hasCredentials && biometricType !== null,
    biometricType,
    isLoading,
    error,
    reset: () => setError(null),

    authenticate: async () => {
      setIsLoading(true);
      setError(null);
      try {
        const signInResource = await authenticate();
        if (signInResource.status === 'complete' && setActive) {
          await setActive({ session: signInResource.createdSessionId });
          return { success: true };
        }
        setError({ code: 'biometric_incomplete', message: 'Could not finish sign-in.' });
        return { success: false };
      } catch (e: unknown) {
        const cancelled =
          e && typeof e === 'object' && 'code' in e && String((e as { code: unknown }).code).includes('cancel');
        if (!cancelled) setError({ code: 'biometric_failed', message: extractMessage(e) });
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },

    remember: async (identifier: string, password: string) => {
      try {
        await setCredentials({ identifier, password });
      } catch {
        /* non-fatal — biometrics just won't be offered next time */
      }
    },
  };
}

function extractMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'errors' in e && Array.isArray((e as { errors: unknown }).errors)) {
    const first = (e as { errors: { message?: string; longMessage?: string }[] }).errors[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return 'Face ID sign-in failed. Try your password.';
}
