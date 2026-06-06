import { type DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { Dimensions, FlatList, Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';

const TILE_WIDTH = Math.round(Dimensions.get('window').width * 0.42);
const TILE_HEIGHT = Math.round(TILE_WIDTH * 0.72);

/**
 * Curated tile images per category (parallel to the web's TREATMENT_TILE_IMAGES).
 * When a category has one it overrides the auto-picked deal photo for a more
 * consistent, on-brand look. Add URLs here as art is sourced.
 */
const TILE_IMAGES: Record<string, string> = {
  // injectables: 'https://…/injectables.jpg',
};

export interface BrowseCategory {
  slug: string;
  displayName: string;
  deals: DealSummary[];
}

interface Props {
  categories: BrowseCategory[];
  onSelect: (slug: string) => void;
}

/**
 * "Browse by category" — a horizontal row of photo tiles, one per category that
 * has deals. Mirrors the website's "Browse by treatment" row. Tapping a tile
 * opens that category. Uses a curated image when available, else a real deal
 * photo from that category.
 */
export function BrowseByCategory({ categories, onSelect }: Props) {
  const { color: palette } = useTheme();
  if (categories.length === 0) return null;

  return (
    <Stack gap={3}>
      <View style={{ paddingHorizontal: space[5] }}>
        <Text variant="display-sm" tone="primary" weight="medium">
          Browse by category
        </Text>
      </View>

      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c.slug}
        contentContainerStyle={{ paddingHorizontal: space[5], gap: space[3] }}
        renderItem={({ item }) => {
          const img = TILE_IMAGES[item.slug] ?? item.deals.find((d) => d.primaryPhotoUrl)?.primaryPhotoUrl ?? null;
          const count = item.deals.length;
          return (
            <Pressable
              onPress={() => onSelect(item.slug)}
              style={({ pressed }) => ({ width: TILE_WIDTH, opacity: pressed ? 0.85 : 1 })}
            >
              <View
                style={{
                  width: TILE_WIDTH,
                  height: TILE_HEIGHT,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  backgroundColor: palette.surface.secondary,
                }}
              >
                <CachedImage uri={img} style={{ width: '100%', height: '100%' }} />
                {/* Dark gradient-ish scrim for label legibility */}
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2],
                    backgroundColor: 'rgba(43,32,25,0.42)',
                  }}
                >
                  <Text variant="body-md" weight="semibold" style={{ color: '#fff' }}>
                    {item.displayName}
                  </Text>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {count} deal{count === 1 ? '' : 's'} nearby
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </Stack>
  );
}
