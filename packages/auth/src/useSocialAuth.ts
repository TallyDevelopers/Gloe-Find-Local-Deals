import { useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import type { AuthError, SocialProvider } from './types';

// Ensures the in-app browser closes and hands control back after OAuth redirect.
WebBrowser.maybeCompleteAuthSession();

const STRATEGY = {
  google: 'oauth_google',
  apple: 'oauth_apple',
  facebook: 'oauth_facebook',
  tiktok: 'oauth_tiktok',
} as const satisfies Record<SocialProvider, string>;

interface SocialAuthFlow {
  signInWithSocial: (provider: SocialProvider) => Promise<{ success: boolean }>;
  pending: SocialProvider | null;
  error: AuthError | null;
  reset: () => void;
}

/**
 * Social / OAuth sign-in (Google, Facebook, TikTok, Apple) via Clerk's hosted
 * flow. Opens an in-app browser, completes the round-trip, and activates the
 * session. Same `useAuth()` signed-in state picks it up afterward.
 *
 * Whichever providers actually appear depend on what's enabled in the Clerk
 * dashboard — a disabled provider will error when tapped.
 */
export function useSocialAuth(): SocialAuthFlow {
  const { startSSOFlow } = useSSO();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<AuthError | null>(null);

  // Warm the browser on iOS for a snappier first tap.
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const signInWithSocial = useCallback(
    async (provider: SocialProvider) => {
      setError(null);
      setPending(provider);
      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy: STRATEGY[provider],
          // Redirect back into the app (scheme `gloe`) after the OAuth round-trip.
          redirectUrl: Linking.createURL('/sso-callback'),
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          return { success: true };
        }
        // No session = user cancelled, or the flow needs extra steps (rare).
        return { success: false };
      } catch (e: unknown) {
        setError({ code: 'social_failed', message: extractMessage(e, provider) });
        return { success: false };
      } finally {
        setPending(null);
      }
    },
    [startSSOFlow],
  );

  return { signInWithSocial, pending, error, reset: () => setError(null) };
}

function extractMessage(e: unknown, provider: SocialProvider): string {
  if (e && typeof e === 'object' && 'errors' in e && Array.isArray((e as { errors: unknown }).errors)) {
    const errors = (e as { errors: { message?: string; longMessage?: string }[] }).errors;
    const first = errors[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return `Couldn't sign in with ${provider}. Try again.`;
}
