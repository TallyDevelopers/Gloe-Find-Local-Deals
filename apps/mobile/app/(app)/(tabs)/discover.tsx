import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { Link, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { useAnonSeed } from '../../../features/discover/anonSeed';
import { CategoryRail } from '../../../features/discover/CategoryRail';
import { DealCardLarge } from '../../../features/discover/DealCardLarge';
import { FeaturedCarousel } from '../../../features/discover/FeaturedCarousel';
import { CATEGORY_OPTIONS, FilterPills } from '../../../features/discover-header/FilterPills';
import { FilterSheet, type DiscoverFilters } from '../../../features/discover-header/FilterSheet';
import { LocationPill } from '../../../features/discover-header/LocationPill';
import { SearchBar } from '../../../features/discover-header/SearchBar';
import { useSelectedLocation } from '../../../features/discover-header/SelectedLocationProvider';
import { useSavedDeals } from '../../../features/saved/SavedDealsProvider';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useAuth();
  const requireAuth = useRequireAuth();
  const { savedIds, toggle } = useSavedDeals();
  const { location } = useSelectedLocation();
  const { color: palette } = useTheme();
  const anonSeed = useAnonSeed();

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Count of non-default filter sections, for the "Filters · 2" affordance.
  const activeFilterCount =
    (filters.maxDistanceMiles !== undefined ? 1 : 0) +
    (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined ? 1 : 0) +
    (filters.minDiscountPct !== undefined ? 1 : 0);

  // Featured (sponsored) carousel + the filtered grid both read this query.
  // When "All" is selected the body shows category rails instead of the grid.
  const dealsQuery = trpc.deals.list.useQuery({
    userLat: location.latitude,
    userLng: location.longitude,
    maxDistanceMiles: filters.maxDistanceMiles ?? 50,
    limit: 50,
    ...(categorySlug ? { category: categorySlug } : {}),
    ...(filters.minPriceCents !== undefined ? { minPriceCents: filters.minPriceCents } : {}),
    ...(filters.maxPriceCents !== undefined ? { maxPriceCents: filters.maxPriceCents } : {}),
    ...(filters.minDiscountPct !== undefined ? { minDiscountPct: filters.minDiscountPct } : {}),
    ...(anonSeed ? { anonSeed } : {}),
  });

  const isSignedIn = status === 'signed-in';
  const allDeals = dealsQuery.data?.deals ?? [];
  const featured = allDeals.filter((d) => d.isSponsored);
  const rest = allDeals;

  const toggleSave = requireAuth('save', (dealId: string) => toggle(dealId));

  // Refresh the main grid AND every CategoryRail's query in parallel — each
  // rail mounts its own `deals.list` query, so invalidating the whole tree
  // is the only way the spinner reflects actual refetch completion.
  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRefreshing(true);
    try {
      await utils.deals.list.invalidate();
    } finally {
      setIsRefreshing(false);
    }
  }, [utils]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[3],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.brand[500]}
          />
        }
      >
        <Stack gap={4}>
          {/* Header row: location pill (left) + auth link (right) */}
          <Stack
            direction="row"
            justify="space-between"
            align="center"
            paddingX={5}
          >
            <LocationPill />
            {!isSignedIn ? (
              <Link href="/(auth)/login" asChild>
                <Pressable hitSlop={8}>
                  <Text variant="body-md" tone="link" weight="semibold">
                    Sign in
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </Stack>

          {/* Search bar */}
          <View style={{ paddingHorizontal: space[5] }}>
            <SearchBar onPress={() => router.push('/(app)/search')} />
          </View>

          {/* Category filter pills */}
          <View style={{ paddingLeft: space[5], paddingRight: space[3] }}>
            <FilterPills
              selectedSlug={categorySlug}
              onSelect={setCategorySlug}
              onOpenFilters={() => setFilterSheetOpen(true)}
              activeFilterCount={activeFilterCount}
            />
          </View>

          {/* Feed */}
          {dealsQuery.isLoading ? (
            <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
              <ActivityIndicator color={palette.brand[500]} />
            </View>
          ) : dealsQuery.isError ? (
            <View style={{ paddingHorizontal: space[5] }}>
              <Text variant="body-md" tone="error">
                Couldn't load deals. Pull to refresh.
              </Text>
            </View>
          ) : categorySlug === null ? (
            /* "All" view — Featured carousel + a horizontal rail per category. */
            <Stack gap={8} style={{ marginTop: space[2] }}>
              {featured.length > 0 ? (
                <View style={{ paddingLeft: space[5] }}>
                  <FeaturedCarousel deals={featured} onSave={toggleSave} savedIds={savedIds} />
                </View>
              ) : null}

              {CATEGORY_OPTIONS.filter((c) => c.slug !== null).map((c) => (
                <CategoryRail
                  key={c.slug}
                  categorySlug={c.slug as string}
                  label={c.label}
                  userLat={location.latitude}
                  userLng={location.longitude}
                  savedIds={savedIds}
                  onSave={toggleSave}
                  onSeeAll={(slug) => setCategorySlug(slug)}
                  maxDistanceMiles={filters.maxDistanceMiles}
                  minPriceCents={filters.minPriceCents}
                  maxPriceCents={filters.maxPriceCents}
                  minDiscountPct={filters.minDiscountPct}
                  anonSeed={anonSeed}
                />
              ))}
            </Stack>
          ) : (
            /* Filtered view — big full-width cards, vertical scroll. */
            <Stack gap={4} paddingX={5} style={{ marginTop: space[2] }}>
              {rest.length === 0 ? (
                <Text variant="body-md" tone="secondary">
                  No deals match your filters in {location.label}.
                </Text>
              ) : (
                rest.map((deal) => (
                  <DealCardLarge
                    key={deal.id}
                    deal={deal}
                    isSaved={savedIds.has(deal.id)}
                    onSave={() => toggleSave(deal.id)}
                  />
                ))
              )}
            </Stack>
          )}
        </Stack>
      </ScrollView>

      <FilterSheet
        open={filterSheetOpen}
        initial={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setFilters}
      />
    </View>
  );
}
