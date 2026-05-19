import { useSignUp } from '@clerk/clerk-expo';
import { useCallback, useState } from 'react';

import type { AuthError, SignUpWithPasswordInput } from './types';

type SignUpStage = 'idle' | 'awaiting-verification' | 'complete';

interface SignUpFlow {
  stage: SignUpStage;
  signUp: (input: SignUpWithPasswordInput) => Promise<{ needsVerification: boolean }>;
  verifyCode: (code: string) => Promise<{ success: boolean }>;
  isLoading: boolean;
  error: AuthError | null;
  reset: () => void;
}

/**
 * Hook for the email+password sign-up flow (two steps: create, then verify
 * email code). Wraps Clerk's `useSignUp` so screens see a flat API.
 */
export function useSignUpFlow(): SignUpFlow {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [stage, setStage] = useState<SignUpStage>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const submit = useCallback(
    async ({ email, password, firstName, lastName }: SignUpWithPasswordInput) => {
      if (!isLoaded || !signUp) {
        return { needsVerification: false };
      }

      setIsLoading(true);
      setError(null);
      try {
        await signUp.create({
          emailAddress: email,
          password,
          firstName,
          lastName,
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStage('awaiting-verification');
        return { needsVerification: true };
      } catch (e: unknown) {
        setError({ code: 'sign_up_failed', message: extractClerkErrorMessage(e) });
        return { needsVerification: false };
      } finally {
        setIsLoading(false);
      }
    },
    [isLoaded, signUp],
  );

  const verifyCode = useCallback(
    async (code: string) => {
      if (!isLoaded || !signUp) {
        return { success: false };
      }

      setIsLoading(true);
      setError(null);
      try {
        const attempt = await signUp.attemptEmailAddressVerification({ code });
        if (attempt.status === 'complete') {
          await setActive({ session: attempt.createdSessionId });
          setStage('complete');
          return { success: true };
        }
        setError({ code: 'verification_incomplete', message: 'Invalid code. Please try again.' });
        return { success: false };
      } catch (e: unknown) {
        setError({ code: 'verification_failed', message: extractClerkErrorMessage(e) });
        return { success: false };
      } finally {
        setIsLoading(false);
      }
    },
    [isLoaded, signUp, setActive],
  );

  return {
    stage,
    signUp: submit,
    verifyCode,
    isLoading,
    error,
    reset: () => {
      setError(null);
      setStage('idle');
    },
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
