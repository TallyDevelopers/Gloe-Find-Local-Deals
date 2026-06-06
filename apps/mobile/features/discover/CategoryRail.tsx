import { type DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { Dimensions, FlatList, Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';
import { DealCard } from './DealCard';

const CARD_WIDTH = Math.round(Dimensions.get('window').width * 0.62);
// The "See all" end tile is narrower than a card — it's a CTA, not content —
// and matches the card's square image area so it lines up with the photo row.
const END_TILE_WIDTH = Math.round(CARD_WIDTH * 0.5);

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
      {/* Header is just the label now — discovery moved into the rail itself
          via the end-of-row "See all" tile (Netflix/ResortPass pattern), so the
          tired top-right "See all →" link is gone. The label stays tappable. */}
      <Pressable onPress={onSeeAll} style={{ paddingHorizontal: space[5] }} hitSlop={6}>
        <Text variant="display-sm" tone="primary" weight="medium">
          {label}
        </Text>
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
        ListFooterComponent={<SeeAllTile onPress={onSeeAll} />}
      />
    </Stack>
  );
}

/**
 * End-of-rail discovery tile: swipe past the last card and you land on a
 * circular arrow + "See all" right where the next card would be — inline
 * discovery in the same gesture, instead of a disconnected corner link.
 * Vertically centered against the cards' square image so it reads as part of
 * the row.
 */
function SeeAllTile({ onPress }: { onPress: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ width: END_TILE_WIDTH, height: CARD_WIDTH, alignItems: 'center', justifyContent: 'center', gap: space[2] }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.pill,
          backgroundColor: palette.surface.elevated,
          borderWidth: 1,
          borderColor: palette.border.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="chevronRight" size={22} color={palette.text.primary} strokeWidth={2.5} />
      </View>
      <Text variant="body-sm" tone="primary" weight="semibold">
        See all
      </Text>
    </Pressable>
  );
}
