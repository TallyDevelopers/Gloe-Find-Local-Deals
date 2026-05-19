import { useSignIn } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';

import type { AuthError, SignInWithPasswordInput } from './types';

interface SignInFlow {
  signIn: (input: SignInWithPasswordInput) => Promise<{ success: boolean }>;
  isLoading: boolean;
  error: AuthError | null;
  reset: () => void;
}

/**
 * Hook for the email+password sign-in flow.
 *
 * This wraps Clerk's `useSignIn` and exposes a single async function our screens
 * can call. Returns success status; the AuthProvider will pick up the new
 * signed-in state via Clerk's session.
 */
export function useSignInFlow(): SignInFlow {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const submit = useCallback(
    async ({ email, password }: SignInWithPasswordInput) => {
      if (!isLoaded || !signIn) {
        return { success: false };
      }

      setIsLoading(true);
      setError(null);
      try {
        const attempt = await signIn.create({ identifier: email, password });
        if (attempt.status === 'complete') {
          await setActive({ session: attempt.createdSessionId });
          return { success: true };
        }
        // Surface the real Clerk status so we can debug what's missing
        const supportedFirst = attempt.supportedFirstFactors?.map((f) => f.strategy).join(', ');
        const supportedSecond = attempt.supportedSecondFactors?.map((f) => f.strategy).join(', ');
        const detail = [
          `status: ${attempt.status ?? 'unknown'}`,
          supportedFirst ? `1st: ${supportedFirst}` : '',
          supportedSecond ? `2nd: ${supportedSecond}` : '',
        ].filter(Boolean).join(' · ');
        setError({
          code: 'incomplete',
          message: `Additional verification required (${detail}).`,
        });
        return { success: false };
      } catch (e: unknown) {
        const message = extractClerkErrorMessage(e);
        setError({ code: 'sign_in_failed', message });
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [isLoaded, signIn, setActive],
  );

  return {
    signIn: submit,
    isLoading,
    error,
    reset: () => setError(null),
  };
}

function extractClerkErrorMessage(e: unknown): string {
  if (
    e &&
    typeof e === 'object' &&
    'errors' in e &&
    Array.isArray((e as { errors: unknown }).errors)
  ) {
    const errors = (e as { errors: { message?: string; longMessage?: string }[] }).errors;
    const first = errors[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  return 'Something went wrong. Please try again.';
}
