import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, FlatList, Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { DISCOVER_HEADING_SIZE } from './CategoryRail';

// Match the web `.cat-card--carousel` mobile size: 42vw capped at 168px, 5:4.
// Deliberately SMALLER than the deal rail cards (CategoryRail) — deals are the
// hero, categories are wayfinding (approved Discover comp).
const TILE_WIDTH = Math.min(Math.round(Dimensions.get('window').width * 0.42), 168);
const TILE_HEIGHT = Math.round((TILE_WIDTH * 4) / 5);
// Tile name overlay — web's .cat-card-label .name is 18px on carousel tiles,
// but at the smaller 42vw tile 15px keeps two-word names on one line.
const TILE_LABEL_SIZE = 15;

export interface BrowseCategory {
  slug: string;
  displayName: string;
  /** Active deals in this category nearby (for the "N deals nearby" label). */
  dealCount: number;
  /** Curated tile image from the API (shared with web). Null → deal-photo fallback. */
  tileImageUrl: string | null;
  /** A representative deal photo used when there's no curated tile art. */
  fallbackPhotoUrl: string | null;
}

interface Props {
  categories: BrowseCategory[];
  onSelect: (slug: string) => void;
}

/**
 * "Browse by category" — a horizontal row of photo tiles, one per category that
 * has deals. Matches the website's "Browse by treatment" cards exactly: 5:4
 * photo, transparent→dark gradient label, display-font name + "N deals nearby".
 */
export function BrowseByCategory({ categories, onSelect }: Props) {
  const { color: palette } = useTheme();
  if (categories.length === 0) return null;

  return (
    <Stack gap={3}>
      <View style={{ paddingHorizontal: space[5] }}>
        <Text variant="display-sm" tone="primary" weight="semibold" style={{ fontSize: DISCOVER_HEADING_SIZE, lineHeight: DISCOVER_HEADING_SIZE * 1.25, letterSpacing: -0.2 }}>
          Browse by treatment
        </Text>
      </View>

      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c.slug}
        contentContainerStyle={{ paddingHorizontal: space[5], gap: space[4] }}
        renderItem={({ item }) => {
          const img = item.tileImageUrl ?? item.fallbackPhotoUrl;
          const count = item.dealCount;
          return (
            <Pressable
              onPress={() => onSelect(item.slug)}
              style={({ pressed }) => ({ width: TILE_WIDTH, opacity: pressed ? 0.9 : 1 })}
            >
              {/* .cat-card: 5:4, radius-lg, soft shadow, surface-secondary base */}
              <View
                style={{
                  width: TILE_WIDTH,
                  height: TILE_HEIGHT,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  backgroundColor: palette.surface.secondary,
                  shadowColor: '#2B2019',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 18,
                  elevation: 3,
                }}
              >
                <CachedImage uri={img} style={{ width: '100%', height: '100%' }} />
                {/* .cat-card-label: full-inset transparent→dark gradient */}
                <LinearGradient
                  colors={['transparent', 'rgba(43,32,25,0.68)']}
                  locations={[0.35, 1]}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', padding: space[4] }}
                >
                  <Text
                    variant="display-sm"
                    weight="medium"
                    numberOfLines={2}
                    style={{ color: '#fff', fontSize: TILE_LABEL_SIZE, lineHeight: TILE_LABEL_SIZE * 1.15 }}
                  >
                    {item.displayName}
                  </Text>
                  <Text style={{ color: '#fff', opacity: 0.9, fontSize: 12.5, marginTop: 3 }}>
                    {count} deal{count === 1 ? '' : 's'} nearby
                  </Text>
                </LinearGradient>
              </View>
            </Pressable>
          );
        }}
      />
    </Stack>
  );
}
