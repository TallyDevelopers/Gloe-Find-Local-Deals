import { Stack, Text, radius, space, useTheme, type ThemePreference } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../../features/icon/Icon';
import { useThemePreference } from '../../../features/theme/ThemePreferenceProvider';

interface Option {
  value: ThemePreference;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    value: 'system',
    label: 'Match iPhone',
    description: 'Follow your phone — switches with iOS at sunset.',
  },
  {
    value: 'light',
    label: 'Always light',
    description: 'Blush pearl, all the time.',
  },
  {
    value: 'dark',
    label: 'Always dark',
    description: 'Protect those beautiful eyes ✨',
  },
];

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { color: palette } = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingBottom: space[3],
          paddingHorizontal: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          borderBottomWidth: 1,
          borderBottomColor: palette.border.subtle,
          backgroundColor: palette.surface.primary,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ padding: space[2], marginLeft: -space[2] }}
        >
          <Icon name="chevronLeft" size={24} color={palette.text.primary} />
        </Pressable>
        <Text variant="body-lg" tone="primary" weight="semibold">
          Appearance
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: space[5],
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={5}>
          <Stack gap={2}>
            <Text variant="display-sm" tone="primary" weight="medium">
              Light or dark?
            </Text>
            <Text variant="body-md" tone="secondary">
              Match your phone and we'll switch with iOS when the sun goes down.
            </Text>
          </Stack>

          <View
            style={{
              backgroundColor: palette.surface.elevated,
              borderRadius: radius.lg,
              overflow: 'hidden',
            }}
          >
            {OPTIONS.map((option, i) => {
              const isSelected = preference === option.value;
              const isLast = i === OPTIONS.length - 1;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPreference(option.value);
                  }}
                  style={{
                    paddingVertical: space[4],
                    paddingHorizontal: space[5],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[4],
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: palette.border.subtle,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Stack gap={1}>
                      <Text variant="body-md" tone="primary" weight="medium">
                        {option.label}
                      </Text>
                      <Text variant="body-sm" tone="secondary">
                        {option.description}
                      </Text>
                    </Stack>
                  </View>
                  <RadioDot selected={isSelected} />
                </Pressable>
              );
            })}
          </View>
        </Stack>
      </ScrollView>
    </View>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? palette.brand[500] : palette.border.default,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: palette.brand[500],
          }}
        />
      ) : null}
    </View>
  );
}
