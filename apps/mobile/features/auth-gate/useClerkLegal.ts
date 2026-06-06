import { useClerk } from '@clerk/clerk-expo';

/**
 * Reads the Terms / Privacy URLs and the "require legal consent" flag straight
 * from the Clerk environment — i.e. whatever you set in the Clerk Dashboard.
 *
 * This is the seam that makes legal Dashboard-driven: change the URLs or toggle
 * "require consent" in Clerk and the app reflects it with NO code change. Clerk
 * only exposes these via internal accessors, so we read them defensively in this
 * one place — if Clerk ever renames the path, fix it here, not in the sheet.
 */
export interface ClerkLegal {
  termsUrl: string | null;
  privacyUrl: string | null;
  /** True when the Dashboard requires explicit acceptance at sign-up. */
  consentRequired: boolean;
}

export function useClerkLegal(): ClerkLegal {
  const clerk = useClerk();

  // `__unstable__environment` is Clerk's internal env snapshot; guard everything.
  const env = (clerk as unknown as { __unstable__environment?: unknown }).__unstable__environment as
    | {
        displayConfig?: { termsUrl?: string; privacyPolicyUrl?: string };
        userSettings?: { signUp?: { legal_consent_enabled?: boolean } };
      }
    | null
    | undefined;

  const terms = env?.displayConfig?.termsUrl?.trim();
  const privacy = env?.displayConfig?.privacyPolicyUrl?.trim();

  return {
    termsUrl: terms ? terms : null,
    privacyUrl: privacy ? privacy : null,
    consentRequired: Boolean(env?.userSettings?.signUp?.legal_consent_enabled),
  };
}
