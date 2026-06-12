import type { SocialProvider } from '@gloe/auth';
import { Text, radius, space, useTheme } from '@gloe/ui';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppleIcon, GoogleIcon } from './SocialIcons';

/**
 * Social providers, in display order (ResortPass format = icon-only squares in a
 * row). Apple is required on iOS whenever any social login exists (App Store
 * 4.8). Each must be enabled in the Clerk dashboard. Apple + Google only
 * (decided 2026-06-12): Facebook/TikTok dropped at launch — fewer prod
 * credentials, less choice paralysis; revisit post-launch if asked for.
 */
const PROVIDERS: SocialProvider[] = ['apple', 'google'];

interface Props {
  onPress: (provider: SocialProvider) => void;
  pending: SocialProvider | null;
  error: string | null;
}

/** A row of icon-only social buttons (Apple · Google), ResortPass-style. */
export function SocialAuthButtons({ onPress, pending, error }: Props) {
  const { color: palette } = useTheme();
  const mono = palette.text.primary;

  const icon = (p: SocialProvider) => {
    switch (p) {
      case 'apple':
        return <AppleIcon size={24} color={mono} />;
      case 'google':
        return <GoogleIcon size={24} />;
      default:
        return null;
    }
  };

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        {PROVIDERS.map((p) => (
          <Pressable
            key={p}
            onPress={() => onPress(p)}
            disabled={pending !== null}
            style={({ pressed }) => ({
              flex: 1,
              height: 58,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: palette.border.subtle,
              backgroundColor: pressed ? palette.surface.secondary : palette.surface.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pending !== null && pending !== p ? 0.5 : 1,
            })}
          >
            {pending === p ? <ActivityIndicator size="small" color={mono} /> : icon(p)}
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text variant="body-sm" tone="error" align="center">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
