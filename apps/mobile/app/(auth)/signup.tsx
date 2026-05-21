import { useSignUpFlow, useSocialAuth } from '@gloe/auth';
import { Button, Input, Stack, Text, Wordmark, color, radius, space } from '@gloe/ui';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SocialAuthButtons } from '../../features/auth-gate/SocialAuthButtons';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stage, signUp, verifyCode, isLoading, error } = useSignUpFlow();
  const social = useSocialAuth();

  const handleSocial = async (provider: Parameters<typeof social.signInWithSocial>[0]) => {
    const result = await social.signInWithSocial(provider);
    if (result.success) router.replace('/');
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const handleCreate = async () => {
    await signUp({ email: email.trim(), password });
  };

  const handleVerify = async () => {
    const result = await verifyCode(code.trim());
    if (result.success) {
      router.replace('/');
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/discover');
  };

  const isVerifying = stage === 'awaiting-verification';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: color.surface.primary }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + space[4],
          paddingBottom: insets.bottom + space[6],
          paddingHorizontal: space[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack gap={8} flex={1}>
          {/* Close */}
          <View style={{ alignSelf: 'flex-start' }}>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                backgroundColor: color.surface.elevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="body-lg" tone="primary" weight="semibold">
                ✕
              </Text>
            </Pressable>
          </View>

          <Stack gap={3} align="flex-start">
            <Wordmark size={44} />
            <Text variant="body-lg" tone="secondary">
              {isVerifying ? 'Check your email.' : 'Create your account.'}
            </Text>
            {isVerifying ? (
              <Text variant="body-md" tone="tertiary">
                We sent a verification code to {email}.
              </Text>
            ) : null}
          </Stack>

          {isVerifying ? (
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

              {error ? (
                <Text variant="body-sm" tone="error">
                  {error.message}
                </Text>
              ) : null}

              <Button
                label="Verify and continue"
                onPress={handleVerify}
                disabled={code.length < 6 || isLoading}
                loading={isLoading}
                size="lg"
                fullWidth
              />
            </Stack>
          ) : (
            <Stack gap={4}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
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
                placeholder="At least 8 characters"
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleCreate}
                helperText="Use at least 8 characters."
              />

              {error ? (
                <Text variant="body-sm" tone="error">
                  {error.message}
                </Text>
              ) : null}

              <Button
                label="Create account"
                onPress={handleCreate}
                disabled={email.length === 0 || password.length < 8 || isLoading}
                loading={isLoading}
                size="lg"
                fullWidth
              />

              <SocialAuthButtons
                onPress={handleSocial}
                pending={social.pending}
                error={social.error?.message ?? null}
              />
            </Stack>
          )}

          {!isVerifying ? (
            <Stack
              direction="row"
              gap={1}
              justify="center"
              align="center"
              style={{ marginTop: 'auto', paddingTop: space[6] }}
            >
              <Text variant="body-md" tone="secondary">
                Already have an account?
              </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text variant="body-md" tone="link" weight="semibold">
                    Sign in
                  </Text>
                </Pressable>
              </Link>
            </Stack>
          ) : null}
        </Stack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
