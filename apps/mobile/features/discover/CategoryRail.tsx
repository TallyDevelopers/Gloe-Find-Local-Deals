import { type DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { Dimensions, FlatList, Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';
import { DealCard } from './DealCard';

// Match the web's mobile rail cards (232px on a 390 screen ≈ 60vw): deal cards
// are the page's hero — deliberately BIGGER than the category tiles.
const CARD_WIDTH = Math.min(Math.round(Dimensions.get('window').width * 0.6), 232);
// Discover row headings — Browse + editorial section rails. Matches the web's
// mobile `.section-head h2` (18px, Poppins 600). Shared with BrowseByCategory
// so both rows' headings stay identical.
export const DISCOVER_HEADING_SIZE = 18;
// 16:11 image — same media ratio as the web deal card (approved comp).
const RAIL_IMAGE_RATIO = 16 / 11;
// The "See all" end tile is narrower than a card — it's a CTA, not content.
const END_TILE_WIDTH = Math.round(CARD_WIDTH * 0.52);
// Approx full card height (16:11 image + the taller comp text block) so the
// end tile centers against the WHOLE card, not just the image.
const CARD_HEIGHT = Math.round(CARD_WIDTH / RAIL_IMAGE_RATIO) + 150;

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
        <Text variant="display-sm" tone="primary" weight="semibold" style={{ fontSize: DISCOVER_HEADING_SIZE, lineHeight: DISCOVER_HEADING_SIZE * 1.25, letterSpacing: -0.2 }}>
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
            imageAspectRatio={RAIL_IMAGE_RATIO}
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
      style={{ width: END_TILE_WIDTH, height: CARD_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: space[2] }}
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
