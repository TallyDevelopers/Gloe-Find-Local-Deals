import { useFaceId, useSignInFlow, useSignUpFlow, useSocialAuth } from '@gloe/auth';
import { Button, Input, Stack, Text, Wordmark, radius, space, useTheme } from '@gloe/ui';
import { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useAnimatedValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const translateY = useAnimatedValue(800);
  const overlayOpacity = useAnimatedValue(0);

  const signInFlow = useSignInFlow();
  const signUpFlow = useSignUpFlow();
  const social = useSocialAuth();
  const faceId = useFaceId();
  const legal = useClerkLegal();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (prompt) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 260 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [prompt, translateY, overlayOpacity]);

  const resetAll = () => {
    setMode('sign-in');
    setEmail('');
    setPassword('');
    setCode('');
    signInFlow.reset();
    signUpFlow.reset();
    social.reset();
    faceId.reset();
  };

  const animateOut = (after: () => void) => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 800, useNativeDriver: true, damping: 28, stiffness: 280 }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => after());
  };

  const handleClose = () => animateOut(() => { resetAll(); onClose(); });
  const handleAuthed = () => animateOut(() => { resetAll(); onAuthed(); });

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
    <Modal transparent animationType="none" visible={prompt !== null} onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: palette.surface.overlay,
            opacity: overlayOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: palette.surface.primary,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingTop: space[3],
            maxHeight: '94%',
            shadowColor: '#2B2019',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.12,
            shadowRadius: 32,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: 'center', width: 38, height: 4, borderRadius: radius.pill,
              backgroundColor: palette.neutral[300], marginBottom: space[4],
            }}
          />

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space[6], paddingBottom: insets.bottom + space[6] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
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
