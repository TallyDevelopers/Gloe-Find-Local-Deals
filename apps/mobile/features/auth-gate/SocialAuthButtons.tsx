import type { SocialProvider } from '@gloe/auth';
import { Button, Stack, Text, space, useTheme } from '@gloe/ui';
import { View } from 'react-native';

/** Providers we offer, in display order. Must be enabled in the Clerk dashboard. */
const PROVIDERS: { key: SocialProvider; label: string }[] = [
  { key: 'google', label: 'Continue with Google' },
  { key: 'facebook', label: 'Continue with Facebook' },
  { key: 'tiktok', label: 'Continue with TikTok' },
];

interface Props {
  onPress: (provider: SocialProvider) => void;
  pending: SocialProvider | null;
  error: string | null;
}

export function SocialAuthButtons({ onPress, pending, error }: Props) {
  return (
    <Stack gap={3}>
      <Divider />
      {PROVIDERS.map((p) => (
        <Button
          key={p.key}
          label={p.label}
          variant="secondary"
          size="lg"
          fullWidth
          loading={pending === p.key}
          disabled={pending !== null}
          onPress={() => onPress(p.key)}
        />
      ))}
      {error ? (
        <Text variant="body-sm" tone="error" align="center">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

function Divider() {
  const { color: palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], marginVertical: space[1] }}>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.border.subtle }} />
      <Text variant="body-sm" tone="tertiary">
        or
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.border.subtle }} />
    </View>
  );
}
