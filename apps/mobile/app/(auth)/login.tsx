import { useSignInFlow, useSocialAuth } from '@gloe/auth';
import { Button, Input, Stack, Text, Wordmark, radius, space, useTheme } from '@gloe/ui';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SocialAuthButtons } from '../../features/auth-gate/SocialAuthButtons';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, isLoading, error } = useSignInFlow();
  const social = useSocialAuth();
  const { color: palette } = useTheme();

  const handleSocial = async (provider: Parameters<typeof social.signInWithSocial>[0]) => {
    const result = await social.signInWithSocial(provider);
    if (result.success) router.replace('/');
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    const result = await signIn({ email: email.trim(), password });
    if (result.success) {
      router.replace('/');
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/discover');
  };

  const canSubmit = email.length > 0 && password.length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: palette.surface.primary }}
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
                backgroundColor: palette.surface.elevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="body-lg" tone="primary" weight="semibold">
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Brand */}
          <Stack gap={3} align="flex-start">
            <Wordmark size={44} />
            <Text variant="body-lg" tone="secondary">
              Welcome back.
            </Text>
          </Stack>

          {/* Form */}
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
              placeholder="Your password"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            {error ? (
              <Text variant="body-sm" tone="error">
                {error.message}
              </Text>
            ) : null}

            <Stack gap={3} style={{ marginTop: space[2] }}>
              <Button
                label="Sign in"
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={isLoading}
                size="lg"
                fullWidth
              />
              <Pressable
                onPress={() => {
                  /* TODO: forgot password flow */
                }}
                style={{ alignSelf: 'center', padding: space[2] }}
              >
                <Text variant="body-sm" tone="link" weight="medium">
                  Forgot your password?
                </Text>
              </Pressable>
            </Stack>
          </Stack>

          {/* Social logins */}
          <SocialAuthButtons
            onPress={handleSocial}
            pending={social.pending}
            error={social.error?.message ?? null}
          />

          {/* Sign up link */}
          <Stack
            direction="row"
            gap={1}
            justify="center"
            align="center"
            style={{ marginTop: 'auto', paddingTop: space[6] }}
          >
            <Text variant="body-md" tone="secondary">
              New to Gloe?
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text variant="body-md" tone="link" weight="semibold">
                  Create an account
                </Text>
              </Pressable>
            </Link>
          </Stack>
        </Stack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
