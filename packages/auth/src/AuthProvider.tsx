import { ClerkProvider, useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { tokenCache } from './tokenCache';
import type {
  AuthContextValue,
  AuthStatus,
  AuthUser,
  SignInWithPasswordInput,
  SignUpWithPasswordInput,
  SocialProvider,
} from './types';

/**
 * AuthProvider — the seam between our app and Clerk.
 *
 * Screens import `useAuth()` from this package, NOT from @clerk/clerk-expo.
 * If we swap providers later, only this file changes.
 *
 * The sign-in / sign-up flows themselves use Clerk's `useSignIn` / `useSignUp`
 * hooks directly inside dedicated wrapper hooks (see `useSignInFlow`,
 * `useSignUpFlow`) because those flows are inherently multi-step (email +
 * password → verification code → done). Wrapping them as a single function
 * here would lose the intermediate state.
 */

const AuthContext = createContext<Pick<AuthContextValue, 'status' | 'user' | 'signOut'> | null>(
  null,
);

interface AuthProviderProps {
  publishableKey: string;
  children: ReactNode;
}

export function AuthProvider({ publishableKey, children }: AuthProviderProps) {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthStateProvider>{children}</AuthStateProvider>
    </ClerkProvider>
  );
}

function AuthStateProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();

  const status: AuthStatus = !isLoaded ? 'loading' : isSignedIn ? 'signed-in' : 'signed-out';

  const user: AuthUser | null = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    };
  }, [clerkUser]);

  const signOut = useCallback(async () => {
    await clerkSignOut();
  }, [clerkSignOut]);

  const value = useMemo(() => ({ status, user, signOut }), [status, user, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

// Re-export for screens that need the multi-step sign-in / sign-up flows
export { useSignInFlow } from './useSignInFlow';
export { useSignUpFlow } from './useSignUpFlow';
export { useSocialAuth } from './useSocialAuth';
export type { SignInWithPasswordInput, SignUpWithPasswordInput, SocialProvider };
