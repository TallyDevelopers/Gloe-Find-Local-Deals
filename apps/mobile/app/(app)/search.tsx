import { Stack, Text, color, radius, shadow, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Search screen stub. Real implementation (fuzzy search, recent queries,
 * trending, sponsored results at top) is a follow-up patch.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
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
              <Text variant="body-lg" tone="primary" weight="semibold">
                ←
              </Text>
            </Pressable>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[2],
                backgroundColor: color.surface.elevated,
                borderRadius: radius.pill,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                ...shadow.sm,
              }}
            >
              <Text style={{ fontSize: 16, color: color.text.tertiary }}>🔍</Text>
              <TextInput
                placeholder="Search Botox, filler, lasers…"
                placeholderTextColor={color.text.tertiary}
                style={{
                  flex: 1,
                  fontFamily: 'Inter',
                  fontSize: 16,
                  color: color.text.primary,
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
