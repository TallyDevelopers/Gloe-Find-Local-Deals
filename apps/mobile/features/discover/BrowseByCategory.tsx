import { type DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Dimensions, FlatList, Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';

// Match the web `.cat-card--carousel`: 62vw, capped at 240px, 5:4 aspect ratio.
const TILE_WIDTH = Math.min(Math.round(Dimensions.get('window').width * 0.62), 240);
const TILE_HEIGHT = Math.round((TILE_WIDTH * 4) / 5);

export interface BrowseCategory {
  slug: string;
  displayName: string;
  deals: DealSummary[];
  /** Curated tile image from the API (shared with web). Null → deal-photo fallback. */
  tileImageUrl: string | null;
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
        <Text variant="display-sm" tone="primary" weight="medium">
          Browse by category
        </Text>
      </View>

      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c.slug}
        contentContainerStyle={{ paddingHorizontal: space[5], gap: space[4] }}
        renderItem={({ item }) => {
          const img = item.tileImageUrl ?? item.deals.find((d) => d.primaryPhotoUrl)?.primaryPhotoUrl ?? null;
          const count = item.deals.length;
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
                    style={{ color: '#fff', fontSize: 21, lineHeight: 21 * 1.1 }}
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
