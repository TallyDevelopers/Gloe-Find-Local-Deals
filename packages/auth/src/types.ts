/**
 * Auth domain types — provider-agnostic.
 *
 * Everything our app talks to goes through these types. If we swap Clerk for
 * better-auth/Auth0/anything else, only the provider implementation changes.
 * Screens and hooks consume this interface.
 */

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

export interface SignInWithPasswordInput {
  email: string;
  password: string;
}

export interface SignUpWithPasswordInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export type SocialProvider = 'apple' | 'google';

export interface AuthError {
  code: string;
  message: string;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export interface AuthActions {
  signInWithPassword: (input: SignInWithPasswordInput) => Promise<void>;
  signUpWithPassword: (input: SignUpWithPasswordInput) => Promise<{ needsVerification: boolean }>;
  verifyEmailCode: (code: string) => Promise<void>;
  signInWithSocial: (provider: SocialProvider) => Promise<void>;
  signOut: () => Promise<void>;
}

export type AuthContextValue = AuthState & AuthActions;
