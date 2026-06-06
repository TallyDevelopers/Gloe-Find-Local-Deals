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
        const { createdSessionId, setActive, signUp, authSessionResult } = await startSSOFlow({
          strategy: STRATEGY[provider],
          // Redirect back into the app (scheme `gloe`) after the OAuth round-trip.
          redirectUrl: Linking.createURL('/sso-callback'),
        });

        // User dismissed the Apple/Google sheet — silent no-op, no error.
        if (authSessionResult?.type === 'cancel' || authSessionResult?.type === 'dismiss') {
          return { success: false };
        }

        // Happy path: existing user, or new user whose transfer-signup completed.
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          return { success: true };
        }

        // New user where the transfer signup didn't finish — usually a missing
        // required field. Our Clerk instance may require a username, which Apple
        // doesn't provide, so set one and complete the signup ourselves.
        if (signUp && setActive && (signUp.status === 'missing_requirements' || signUp.id)) {
          try {
            if (signUp.missingFields?.includes('username')) {
              await signUp.update({ username: deriveUsername(signUp.emailAddress ?? `user${signUp.id}`) });
            }
            if (signUp.createdSessionId) {
              await setActive({ session: signUp.createdSessionId });
              return { success: true };
            }
          } catch (inner) {
            setError({ code: 'social_failed', message: extractMessage(inner, provider) });
            return { success: false };
          }
        }

        setError({ code: 'social_incomplete', message: `Couldn't finish ${provider} sign-in. Please try again.` });
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

/** Hidden unique username from an email (some Clerk instances require one; Apple doesn't provide it). */
function deriveUsername(seed: string): string {
  const base = (seed.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
  return `${base}${Math.random().toString(36).slice(2, 7)}`;
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
