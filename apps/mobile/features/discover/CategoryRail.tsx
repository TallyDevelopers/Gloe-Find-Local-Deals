import { type DealSummary } from '@gloe/api-client';
import { Stack, Text, space } from '@gloe/ui';
import { Dimensions, FlatList, Pressable } from 'react-native';

import { DealCard } from './DealCard';

const CARD_WIDTH = Math.round(Dimensions.get('window').width * 0.62);

interface CategoryRailProps {
  label: string;
  /** Deals for this rail — supplied by the parent's single discoverFeed query
   *  (the rail no longer fetches its own data; that fan-out drained the pool). */
  deals: DealSummary[];
  savedIds: Set<string>;
  onSave: (dealId: string) => void;
  onSeeAll: () => void;
}

/**
 * One horizontal category row on the Discover "All" view. Purely
 * presentational: it renders the deals handed to it. Tap "See all" to open the
 * full category view (which paginates). Hides itself if empty.
 */
export function CategoryRail({ label, deals, savedIds, onSave, onSeeAll }: CategoryRailProps) {
  if (deals.length === 0) return null;

  return (
    <Stack gap={3}>
      <Pressable onPress={onSeeAll} style={{ paddingHorizontal: space[5] }}>
        <Stack direction="row" justify="space-between" align="center">
          <Text variant="display-sm" tone="primary" weight="medium">
            {label}
          </Text>
          <Text variant="body-sm" tone="link" weight="semibold">
            See all →
          </Text>
        </Stack>
      </Pressable>

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
            isSaved={savedIds.has(item.id)}
            onSave={() => onSave(item.id)}
          />
        )}
      />
    </Stack>
  );
}
