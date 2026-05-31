import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, space, useTheme } from '@gloe/ui';
import { keepPreviousData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
import { usePrefetch } from '../../../features/prefetch/usePrefetch';
import { useAnonSeed } from '../../../features/discover/anonSeed';
import { CategoryRail } from '../../../features/discover/CategoryRail';
import { ComingSoon } from '../../../features/discover/ComingSoon';
import { DealCardLarge } from '../../../features/discover/DealCardLarge';
import { FeaturedCarousel } from '../../../features/discover/FeaturedCarousel';
import { FilterPills, useCategoryOptions } from '../../../features/discover-header/FilterPills';
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
  const { location, gpsResolved } = useSelectedLocation();
  const { color: palette } = useTheme();
  const anonSeed = useAnonSeed();

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const categoryOptions = useCategoryOptions();

  // Count of non-default filter sections, for the "Filters · 2" affordance.
  const activeFilterCount =
    (filters.maxDistanceMiles !== undefined ? 1 : 0) +
    (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined ? 1 : 0) +
    (filters.minDiscountPct !== undefined ? 1 : 0);

  // Featured (sponsored) carousel + the filtered grid both read this query.
  // When "All" is selected the body shows category rails instead of the grid.
  const dealsQuery = trpc.deals.list.useQuery(
    {
      userLat: location.latitude,
      userLng: location.longitude,
      maxDistanceMiles: filters.maxDistanceMiles ?? 50,
      limit: 50,
      ...(categorySlug ? { category: categorySlug } : {}),
      ...(filters.minPriceCents !== undefined ? { minPriceCents: filters.minPriceCents } : {}),
      ...(filters.maxPriceCents !== undefined ? { maxPriceCents: filters.maxPriceCents } : {}),
      ...(filters.minDiscountPct !== undefined ? { minDiscountPct: filters.minDiscountPct } : {}),
      ...(anonSeed ? { anonSeed } : {}),
    },
    // Keep the previous location's deals on screen (dimmed) while the new ones
    // load, instead of blanking the whole feed to a spinner on every location/
    // filter change. isLoading is now only true on genuine cold start.
    { placeholderData: keepPreviousData },
  );
  const isSwitching = dealsQuery.isPlaceholderData;

  const isSignedIn = status === 'signed-in';
  const allDeals = dealsQuery.data?.deals ?? [];
  const featured = allDeals.filter((d) => d.isSponsored);
  const rest = allDeals;

  // Warm the deal photos into the image cache as soon as the feed data lands,
  // so cards paint instantly instead of streaming in one by one as you scroll.
  const prefetch = usePrefetch();
  useEffect(() => {
    if (allDeals.length) prefetch.images(allDeals.map((d) => d.primaryPhotoUrl));
  }, [allDeals, prefetch]);

  // Out-of-area: the feed loaded successfully with ZERO deals near a real,
  // resolved location AND the user hasn't chosen to browse SoCal anyway. We
  // require gpsResolved so we don't flash this during the initial GPS read
  // (the app starts on the San Diego fallback, which does have deals). When
  // the user picks a far city in the picker, location.fromGPS is false but
  // it's still a deliberate location with no deals → also show coming-soon.
  const [browseAnyway, setBrowseAnyway] = useState(false);
  const outOfArea =
    !dealsQuery.isLoading &&
    !dealsQuery.isError &&
    gpsResolved &&
    allDeals.length === 0 &&
    categorySlug === null &&
    activeFilterCount === 0 &&
    !browseAnyway;

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

          {/* Thin "updating…" bar ONLY while swapping to new results with old
              ones still on screen — cold start is owned by the big spinner below,
              and we don't show it over the empty / out-of-area states. */}
          {dealsQuery.isFetching && !dealsQuery.isLoading && !outOfArea ? (
            <Stack direction="row" gap={2} align="center" justify="center" style={{ paddingVertical: space[2] }}>
              <ActivityIndicator size="small" color={palette.brand[500]} />
              <Text variant="caption" tone="secondary">
                Finding deals near {location.label}…
              </Text>
            </Stack>
          ) : null}

          {/* Feed. While switching with cached data, the old results stay painted
              (dimmed). With no cached data, show the spinner above + skeleton space. */}
          <View
            style={{ opacity: isSwitching ? 0.45 : 1 }}
            pointerEvents={isSwitching ? 'none' : 'auto'}
          >
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
          ) : outOfArea ? (
            <ComingSoon
              cityLabel={location.label}
              lat={location.latitude}
              lng={location.longitude}
              onBrowseAnyway={() => setBrowseAnyway(true)}
            />
          ) : categorySlug === null ? (
            /* "All" view — Featured carousel + a horizontal rail per category. */
            <Stack gap={8} style={{ marginTop: space[2] }}>
              {featured.length > 0 ? (
                <View style={{ paddingLeft: space[5] }}>
                  <FeaturedCarousel deals={featured} onSave={toggleSave} savedIds={savedIds} />
                </View>
              ) : null}

              {categoryOptions.filter((c) => c.slug !== null).map((c) => (
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
          </View>
        </Stack>
      </ScrollView>

      <FilterSheet
        open={filterSheetOpen}
        initial={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setFilters}
      />
      <StatusBarBackdrop />
    </View>
  );
}
