import { trpc, type DealSummary } from '@gloe/api-client';
import { Stack, Text, space, useTheme } from '@gloe/ui';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, View } from 'react-native';

import { DealCard } from './DealCard';

const PAGE = 8;
const CARD_WIDTH = Math.round(Dimensions.get('window').width * 0.62);

interface CategoryRailProps {
  categorySlug: string;
  label: string;
  userLat: number;
  userLng: number;
  savedIds: Set<string>;
  onSave: (dealId: string) => void;
  onSeeAll: (slug: string) => void;
  /** Optional filter overrides from the FilterSheet. Each rail honors the
   *  same constraints as the main grid so a 5-mi filter actually means 5 mi. */
  maxDistanceMiles?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  minDiscountPct?: number;
  /** Per-install seed for ranking jitter — keeps every rail in sync. */
  anonSeed?: string | null;
}

/**
 * One horizontal category row on the Discover "All" view. Loads a page of that
 * category's deals and fetches the next page as the user swipes toward the end
 * (infinite horizontal scroll). Hides itself entirely if the category is empty.
 */
export function CategoryRail({
  categorySlug,
  label,
  userLat,
  userLng,
  savedIds,
  onSave,
  onSeeAll,
  maxDistanceMiles,
  minPriceCents,
  maxPriceCents,
  minDiscountPct,
  anonSeed,
}: CategoryRailProps) {
  const { color: palette } = useTheme();
  const [offset, setOffset] = useState(0);

  // Paging by offset; accumulate each fetched page into a local map.
  const [pages, setPages] = useState<Record<number, DealSummary[]>>({});
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // When the filter set changes, reset paging — otherwise we'd append pages
  // from one filter onto pages from another (e.g. the user goes from 50 mi to
  // 5 mi and we'd still show the old 23-mi cards from the previous page 0).
  const filterKey = `${maxDistanceMiles ?? 'd'}|${minPriceCents ?? 'p'}|${maxPriceCents ?? 'P'}|${minDiscountPct ?? 'g'}|${anonSeed ?? ''}`;
  useEffect(() => {
    setPages({});
    setHasMore(true);
    setOffset(0);
  }, [filterKey]);

  const query = trpc.deals.list.useQuery({
    userLat,
    userLng,
    maxDistanceMiles: maxDistanceMiles ?? 50,
    category: categorySlug,
    limit: PAGE,
    offset,
    ...(minPriceCents !== undefined ? { minPriceCents } : {}),
    ...(maxPriceCents !== undefined ? { maxPriceCents } : {}),
    ...(minDiscountPct !== undefined ? { minDiscountPct } : {}),
    ...(anonSeed ? { anonSeed } : {}),
  });

  // RQ v5 has no onSuccess — append whenever the current offset's data arrives.
  useEffect(() => {
    if (!query.data) return;
    setPages((prev) => ({ ...prev, [offset]: query.data.deals }));
    setHasMore(query.data.hasMore);
    setLoadingMore(false);
  }, [query.data, offset]);

  const deals = useMemo(
    () =>
      Object.keys(pages)
        .map(Number)
        .sort((a, b) => a - b)
        .flatMap((k) => pages[k] ?? []),
    [pages],
  );

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setOffset((o) => o + PAGE);
  };

  // Don't render the header until we actually have cards to show — avoids the
  // bare "Skin   See all →" rows when a category is empty, still loading, or the
  // fetch errored. The rail simply appears once its first deals arrive.
  if (deals.length === 0) return null;

  return (
    <Stack gap={3}>
      <Pressable onPress={() => onSeeAll(categorySlug)} style={{ paddingHorizontal: space[5] }}>
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            width={CARD_WIDTH}
            isSaved={savedIds.has(item.id)}
            onSave={() => onSave(item.id)}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ width: 60, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={palette.brand[500]} />
            </View>
          ) : null
        }
      />
    </Stack>
  );
}
