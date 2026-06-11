import { useFaceId, useSignInFlow, useSignUpFlow, useSocialAuth } from '@gloe/auth';
import { BottomSheet, BottomSheetScrollView, Button, Input, Stack, Text, Wordmark, space, useTheme } from '@gloe/ui';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setPendingReferralCode } from '../referral/pendingReferralCode';
import { SocialAuthButtons } from './SocialAuthButtons';
import { useClerkLegal } from './useClerkLegal';
import type { AuthGatePrompt } from './types';

interface AuthGateSheetProps {
  prompt: AuthGatePrompt | null;
  onClose: () => void;
  /** Run after a successful in-sheet sign-in/sign-up (resumes the gated action). */
  onAuthed: () => void;
}

/** Which view the sheet shows. `verify` is the email-code step of sign-up. */
type Mode = 'sign-in' | 'sign-up' | 'verify';

/**
 * The Gloē auth sheet — our design in the ResortPass layout: logo → sign-up
 * link → email → password → Forgot password → Log In → Sign in with Face ID →
 * "OR / Continue with" → icon-only social row (Apple · Google · Facebook) →
 * legal. Sign-in/sign-up/verify all happen inline; on success the gated action
 * resumes (`onAuthed`, e.g. continue to checkout). Clerk powers all auth.
 */
export function AuthGateSheet({ prompt, onClose, onAuthed }: AuthGateSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();

  const signInFlow = useSignInFlow();
  const signUpFlow = useSignUpFlow();
  const social = useSocialAuth();
  const faceId = useFaceId();
  const legal = useClerkLegal();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const resetAll = () => {
    setMode('sign-in');
    setEmail('');
    setPassword('');
    setCode('');
    setReferralCode('');
    signInFlow.reset();
    signUpFlow.reset();
    social.reset();
    faceId.reset();
  };

  // The sheet animates out on its own once `prompt` clears (open → false).
  const handleClose = () => { resetAll(); onClose(); };
  const handleAuthed = () => { resetAll(); onAuthed(); };

  const switchMode = (next: Mode) => {
    setPassword('');
    signInFlow.reset();
    signUpFlow.reset();
    social.reset();
    setMode(next);
  };

  const handleSignIn = async () => {
    const result = await signInFlow.signIn({ email: email.trim(), password });
    if (result.success) {
      // Remember these creds so Face ID works next time.
      void faceId.remember(email.trim(), password);
      handleAuthed();
    }
  };

  const handleFaceId = async () => {
    const result = await faceId.authenticate();
    if (result.success) handleAuthed();
  };

  const handleCreate = async () => {
    // Stash the invite code BEFORE the account exists — it rides every request
    // as a header, and attribution fires when the server first sees the user.
    setPendingReferralCode(referralCode);
    const result = await signUpFlow.signUp({
      email: email.trim(),
      password,
      legalAccepted: legal.consentRequired ? true : undefined,
    });
    if (result.needsVerification) setMode('verify');
  };

  const handleVerify = async () => {
    const result = await signUpFlow.verifyCode(code.trim());
    if (result.success) {
      void faceId.remember(email.trim(), password);
      handleAuthed();
    }
  };

  const handleSocial = async (provider: Parameters<typeof social.signInWithSocial>[0]) => {
    // Social auth may JIT-create an account too — carry any typed invite code.
    if (referralCode.trim()) setPendingReferralCode(referralCode);
    const result = await social.signInWithSocial(provider);
    if (result.success) handleAuthed();
  };

  const openUrl = (url: string | null) => { if (url) void Linking.openURL(url); };

  if (!prompt) return null;

  const isSignUp = mode === 'sign-up';
  const isVerify = mode === 'verify';
  const busy = signInFlow.isLoading || signUpFlow.isLoading;
  const formError = signInFlow.error?.message ?? signUpFlow.error?.message ?? faceId.error?.message ?? null;
  const faceLabel = faceId.biometricType === 'fingerprint' ? 'Sign in with Touch ID' : 'Sign in with Face ID';

  return (
    <BottomSheet
      open={prompt !== null}
      onClose={handleClose}
      keyboardAvoiding
      maxHeight="94%"
      style={{
        shadowColor: '#2B2019',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 32,
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: space[6], paddingBottom: insets.bottom + space[6] }}
      >
            {/* --- Logo + sign-in/up toggle --- */}
            <Stack gap={2} align="center" style={{ marginBottom: space[6] }}>
              <Wordmark size={34} tone="gold" />
              {!isVerify ? (
                <Stack direction="row" gap={1} justify="center" align="center" style={{ marginTop: space[2] }}>
                  <Text variant="body-md" tone="secondary">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  </Text>
                  <Pressable onPress={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}>
                    <Text variant="body-md" tone="primary" weight="semibold" style={{ textDecorationLine: 'underline' }}>
                      {isSignUp ? 'Log In' : 'Sign Up'}
                    </Text>
                  </Pressable>
                </Stack>
              ) : (
                <Text variant="body-md" tone="secondary" align="center" style={{ marginTop: space[2] }}>
                  We sent a 6-digit code to {email}.
                </Text>
              )}
            </Stack>

            {isVerify ? (
              /* --- Email verification code --- */
              <Stack gap={4}>
                <Input
                  label="Verification code"
                  value={code}
                  onChangeText={setCode}
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
                {formError ? <Text variant="body-sm" tone="error">{formError}</Text> : null}
                <Button
                  label="Verify & continue"
                  onPress={handleVerify}
                  disabled={code.length < 6 || signUpFlow.isLoading}
                  loading={signUpFlow.isLoading}
                  size="lg"
                  fullWidth
                />
                <Pressable onPress={() => switchMode('sign-up')} style={{ alignSelf: 'center', padding: space[2] }}>
                  <Text variant="body-sm" tone="link" weight="medium">Use a different email</Text>
                </Pressable>
              </Stack>
            ) : (
              <Stack gap={5}>
                {/* Email + password */}
                <Stack gap={4}>
                  <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                  />
                  <Input
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    autoCapitalize="none"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    secureTextEntry
                    textContentType={isSignUp ? 'newPassword' : 'password'}
                    returnKeyType="done"
                    onSubmitEditing={isSignUp ? handleCreate : handleSignIn}
                    helperText={isSignUp ? 'Use at least 8 characters.' : undefined}
                  />

                  {/* Referral code — sign-up only, optional. Attribution happens
                      server-side at account creation (x-gloe-referral-code header). */}
                  {isSignUp ? (
                    <Input
                      label="Referral code (optional)"
                      value={referralCode}
                      onChangeText={(v) => setReferralCode(v.toUpperCase())}
                      placeholder="From a friend's invite"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={12}
                      returnKeyType="done"
                      onSubmitEditing={handleCreate}
                    />
                  ) : null}

                  {/* Forgot password — right-aligned (sign-in only) */}
                  {!isSignUp ? (
                    <Pressable
                      onPress={() => openUrl(process.env.EXPO_PUBLIC_CLERK_ACCOUNTS_URL ? `${process.env.EXPO_PUBLIC_CLERK_ACCOUNTS_URL}/sign-in` : null)}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      <Text variant="body-sm" tone="primary" weight="medium" style={{ textDecorationLine: 'underline' }}>
                        Forgot password?
                      </Text>
                    </Pressable>
                  ) : null}

                  {formError ? <Text variant="body-sm" tone="error">{formError}</Text> : null}

                  <Button
                    label={isSignUp ? 'Create account' : 'Log In'}
                    onPress={isSignUp ? handleCreate : handleSignIn}
                    disabled={
                      isSignUp
                        ? email.length === 0 || password.length < 8 || busy
                        : email.length === 0 || password.length === 0 || busy
                    }
                    loading={busy}
                    size="lg"
                    fullWidth
                  />

                  {/* Face ID — only when device has stored creds + biometrics (sign-in) */}
                  {!isSignUp && faceId.available ? (
                    <Button
                      label={faceLabel}
                      onPress={handleFaceId}
                      variant="secondary"
                      size="lg"
                      fullWidth
                      loading={faceId.isLoading}
                    />
                  ) : null}
                </Stack>

                {/* OR / Continue with → icon-only social row */}
                <Stack gap={4}>
                  <Divider label="OR" palette={palette} />
                  <Text variant="body-md" tone="secondary" align="center">Continue with</Text>
                  <SocialAuthButtons
                    onPress={handleSocial}
                    pending={social.pending}
                    error={social.error?.message ?? null}
                  />
                </Stack>

                {/* Legal */}
                <Text variant="caption" tone="tertiary" align="center" style={{ maxWidth: 340, alignSelf: 'center' }}>
                  By continuing, you agree to our{' '}
                  <Text
                    variant="caption"
                    tone="secondary"
                    style={{ textDecorationLine: 'underline' }}
                    onPress={() => openUrl(legal.termsUrl)}
                  >
                    Terms &amp; Conditions
                  </Text>{' '}
                  and{' '}
                  <Text
                    variant="caption"
                    tone="secondary"
                    style={{ textDecorationLine: 'underline' }}
                    onPress={() => openUrl(legal.privacyUrl)}
                  >
                    Privacy Policy
                  </Text>.
                </Text>
              </Stack>
            )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function Divider({ label, palette }: { label: string; palette: ReturnType<typeof useTheme>['color'] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.border.subtle }} />
      <Text variant="body-sm" tone="tertiary">{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.border.subtle }} />
    </View>
  );
}
