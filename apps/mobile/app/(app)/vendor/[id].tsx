import { Stack, Text, color, space } from '@gloe/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Vendor profile stub — full implementation is the next patch.
 * Will show: vendor info, all active deals grouped by category, reviews, photos.
 */
export default function VendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.surface.primary,
        paddingTop: insets.top + space[6],
        paddingHorizontal: space[6],
      }}
    >
      <Stack gap={4}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text variant="body-md" tone="secondary">
            ← Back
          </Text>
        </Pressable>
        <Text variant="display-md" tone="primary" weight="medium">
          Vendor profile
        </Text>
        <Text variant="body-md" tone="secondary">
          Coming soon — this is where you'll see {id ?? 'the vendor'}'s full menu of deals, reviews, photos, and hours.
        </Text>
      </Stack>
    </View>
  );
}
