import { trpc } from '@gloe/api-client';
import { Stack, Text, space } from '@gloe/ui';
import { Dimensions, FlatList, View } from 'react-native';

import { DealCard } from './DealCard';
import { DISCOVER_HEADING_SIZE } from './CategoryRail';
import { useRecentlyViewed } from './useRecentlyViewed';

// Deliberately smaller than the category rails (~0.40 vs 0.56 screen) — this is
// a quiet "pick up where you left off" strip, not a merchandising rail.
const CARD_WIDTH = Math.round(Dimensions.get('window').width * 0.4);
const IMAGE_RATIO = 4 / 3;

interface Props {
  userLat: number;
  userLng: number;
  savedIds: Set<string>;
  onSave: (dealId: string) => void;
}

/**
 * "Recently viewed" — a small horizontal strip at the top of the Discover All
 * view showing the deals the user recently opened (newest first), read from
 * device-local storage. Renders nothing until there's at least one. Deals that
 * are no longer active/visible are dropped server-side (deals.byIds), so the
 * strip self-heals as inventory changes.
 */
export function RecentlyViewed({ userLat, userLng, savedIds, onSave }: Props) {
  const ids = useRecentlyViewed();

  const query = trpc.deals.byIds.useQuery(
    { ids, userLat, userLng },
    { enabled: ids.length > 0 },
  );

  const deals = query.data?.deals ?? [];
  // Nothing viewed yet, or none of them resolved → render nothing (no bare header).
  if (ids.length === 0 || deals.length === 0) return null;

  return (
    <Stack gap={3}>
      <View style={{ paddingHorizontal: space[5] }}>
        <Text variant="display-sm" tone="primary" weight="medium" style={{ fontSize: DISCOVER_HEADING_SIZE, lineHeight: DISCOVER_HEADING_SIZE * 1.15 }}>
          Recently viewed
        </Text>
      </View>

      <FlatList
        data={deals}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: space[5], gap: space[3] }}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            width={CARD_WIDTH}
            imageAspectRatio={IMAGE_RATIO}
            isSaved={savedIds.has(item.id)}
            onSave={() => onSave(item.id)}
          />
        )}
      />
    </Stack>
  );
}
