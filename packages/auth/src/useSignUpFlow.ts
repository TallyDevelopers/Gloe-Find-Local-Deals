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
    async ({ email, password, firstName, lastName, legalAccepted }: SignUpWithPasswordInput) => {
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
          // Only sent when the Dashboard requires consent; Clerk ignores it otherwise.
          ...(legalAccepted ? { legalAccepted: true } : {}),
          // Some Clerk instances require a username. Consumers never see/pick
          // one, so auto-derive a unique handle from the email. Harmless if the
          // instance doesn't require it (Clerk ignores extra fields it allows).
          username: deriveUsername(email),
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setStage('awaiting-verification');
        return { needsVerification: true };
      } catch (e: unknown) {
        // Clerk-Expo intermittently throws "unable to complete a GET request for
        // this Client / no sign up attempt was found" on flaky connectivity —
        // but the sign-up attempt often DID get created. If so, recover: prepare
        // verification and continue instead of surfacing a scary error.
        if (signUp.id && signUp.status === 'missing_requirements') {
          try {
            if (!signUp.unverifiedFields || signUp.unverifiedFields.includes('email_address')) {
              await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            }
            setStage('awaiting-verification');
            return { needsVerification: true };
          } catch {
            /* fall through to the error below */
          }
        }
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
        // Code was accepted but the signup still can't complete — surface the
        // real reason (a missing required field) instead of blaming the code.
        const missing = attempt.missingFields?.join(', ');
        setError({
          code: 'verification_incomplete',
          message: missing
            ? `Almost there — still needs: ${missing}.`
            : 'Could not finish sign-up. Please try again.',
        });
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

/** Derives a hidden, unique username from an email (some Clerk instances require one). */
function deriveUsername(email: string): string {
  const base = (email.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
  return `${base}${Math.random().toString(36).slice(2, 7)}`;
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
