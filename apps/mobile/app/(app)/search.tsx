import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../features/icon/Icon';

/**
 * Search screen stub. Real implementation (fuzzy search, recent queries,
 * trending, sponsored results at top) is a follow-up patch.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { color: palette } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[3],
          paddingBottom: insets.bottom + space[10],
          paddingHorizontal: space[5],
        }}
      >
        <Stack gap={5}>
          {/* Header row */}
          <Stack direction="row" gap={3} align="center">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Icon name="close" size={22} color={palette.text.primary} />
            </Pressable>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                backgroundColor: palette.surface.elevated,
                borderRadius: radius.pill,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                ...shadow.sm,
              }}
            >
              <Icon name="search" size={18} color={palette.text.tertiary} />
              <TextInput
                placeholder="Search Botox, filler, lasers…"
                placeholderTextColor={palette.text.tertiary}
                style={{
                  flex: 1,
                  fontFamily: 'Inter',
                  fontSize: 16,
                  color: palette.text.primary,
                }}
                autoFocus
                returnKeyType="search"
              />
            </View>
          </Stack>

          <Stack gap={2}>
            <Text variant="label" tone="tertiary">
              TRY SEARCHING FOR
            </Text>
            <Stack gap={1}>
              {['Botox', 'Dysport', 'Lip filler', 'Microneedling', 'NAD+ IV', 'Hydrafacial'].map(
                (term) => (
                  <Pressable
                    key={term}
                    style={{ paddingVertical: space[3] }}
                  >
                    <Text variant="body-md" tone="primary">
                      {term}
                    </Text>
                  </Pressable>
                ),
              )}
            </Stack>
          </Stack>

          <Text variant="caption" tone="tertiary" align="center">
            Live search results coming in the next patch.
          </Text>
        </Stack>
      </ScrollView>
    </View>
  );
}
