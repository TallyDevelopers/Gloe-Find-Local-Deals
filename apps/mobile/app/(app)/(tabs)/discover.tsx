import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, space, useTheme } from '@gloe/ui';
import { keepPreviousData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
import { usePrefetch } from '../../../features/prefetch/usePrefetch';
import { useAnonSeed } from '../../../features/discover/anonSeed';
import { CategoryRail } from '../../../features/discover/CategoryRail';
import { ComingSoon } from '../../../features/discover/ComingSoon';
import { DealCard } from '../../../features/discover/DealCard';
import { LocationGate } from '../../../features/discover/LocationGate';
import { BrowseByCategory } from '../../../features/discover/BrowseByCategory';
import { FilterPills } from '../../../features/discover-header/FilterPills';
import { TreatmentPills } from '../../../features/discover-header/TreatmentPills';
import { FilterSheet, type DiscoverFilters } from '../../../features/discover-header/FilterSheet';
import { LocationPickerSheet } from '../../../features/discover-header/LocationPickerSheet';
import { MapButton } from '../../../features/discover-header/MapButton';
import { SearchBar } from '../../../features/discover-header/SearchBar';
import { useSelectedLocation } from '../../../features/discover-header/SelectedLocationProvider';
import { useSavedDeals } from '../../../features/saved/SavedDealsProvider';

// 2-up grid geometry for the filtered/See-all view. screen − horizontal
// padding (space[5] × 2 = 40) − the gap between the two columns, halved.
const GRID_GAP = 12;
const gridCardWidth = Math.floor((Dimensions.get('window').width - 40 - GRID_GAP) / 2);

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useAuth();
  const requireAuth = useRequireAuth();
  const { savedIds, toggle } = useSavedDeals();
  const { location, gpsResolved, gpsDenied, hasLocation } = useSelectedLocation();
  const { color: palette } = useTheme();
  const anonSeed = useAnonSeed();

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  // Optional treatment drill-down under the selected category (second pill row).
  const [subtypeSlug, setSubtypeSlug] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>({});

  // Switching category clears any treatment drill-down — the old treatment
  // doesn't belong to the new category.
  const selectCategory = (slug: string | null) => {
    setCategorySlug(slug);
    setSubtypeSlug(null);
  };
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Location picker, opened from the city segment inside the search bar.
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  // Count of non-default filter sections, for the "Filters · 2" affordance.
  const activeFilterCount =
    (filters.maxDistanceMiles !== undefined ? 1 : 0) +
    (filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined ? 1 : 0) +
    (filters.minDiscountPct !== undefined ? 1 : 0);

  const isAllView = categorySlug === null;
  const isSignedIn = status === 'signed-in';

  // Don't fire deal queries until the inputs have SETTLED. On cold start the
  // location flips (fallback → GPS) and the anon seed flips (null → UUID); each
  // flip is a new query key, so firing eagerly meant 2-3 stacked feed requests
  // that piled up. Gate on: location resolved (GPS done or denied) AND identity
  // ready (signed-in users use their id; anon users wait for the seed).
  const identityReady = isSignedIn || anonSeed !== null;
  // Gate queries on having a REAL location now — no location means the home
  // takeover shows instead of a feed, so there's nothing to fetch yet.
  const inputsReady = hasLocation && identityReady;

  // ── "All" view: the WHOLE screen (featured + every rail) in ONE request.
  // Replaces the old fan-out of one deals.list per rail that drained the pool.
  const feedQuery = trpc.deals.discoverFeed.useQuery(
    {
      userLat: location.latitude,
      userLng: location.longitude,
      maxDistanceMiles: filters.maxDistanceMiles ?? 50,
      ...(filters.minPriceCents !== undefined ? { minPriceCents: filters.minPriceCents } : {}),
      ...(filters.maxPriceCents !== undefined ? { maxPriceCents: filters.maxPriceCents } : {}),
      ...(filters.minDiscountPct !== undefined ? { minDiscountPct: filters.minDiscountPct } : {}),
      ...(anonSeed ? { anonSeed } : {}),
    },
    { placeholderData: keepPreviousData, enabled: isAllView && inputsReady },
  );

  // ── Filtered view (a category/treatment selected): the full vertical grid,
  // a single deals.list call.
  const dealsQuery = trpc.deals.list.useQuery(
    {
      userLat: location.latitude,
      userLng: location.longitude,
      maxDistanceMiles: filters.maxDistanceMiles ?? 50,
      limit: 50,
      ...(categorySlug ? { category: categorySlug } : {}),
      ...(subtypeSlug ? { subtypeSlug } : {}),
      ...(filters.minPriceCents !== undefined ? { minPriceCents: filters.minPriceCents } : {}),
      ...(filters.maxPriceCents !== undefined ? { maxPriceCents: filters.maxPriceCents } : {}),
      ...(filters.minDiscountPct !== undefined ? { minDiscountPct: filters.minDiscountPct } : {}),
      ...(anonSeed ? { anonSeed } : {}),
    },
    { placeholderData: keepPreviousData, enabled: !isAllView && inputsReady },
  );

  // All-view data comes from the feed; filtered-view from deals.list.
  const featured = feedQuery.data?.featured ?? [];
  const rails = feedQuery.data?.rails ?? [];
  const rest = dealsQuery.data?.deals ?? [];

  // The active query for loading/error/empty gating, by view.
  const activeQuery = isAllView ? feedQuery : dealsQuery;
  const isSwitching = activeQuery.isPlaceholderData;
  // Show the spinner both while fetching AND while inputs are still settling
  // (queries disabled until then), so we never flash an empty/out-of-area state.
  const showLoading = activeQuery.isLoading || (!inputsReady && !activeQuery.data);

  // Warm the deal photos into the image cache as soon as data lands, so cards
  // paint instantly instead of streaming in one by one as you scroll.
  const prefetch = usePrefetch();
  useEffect(() => {
    const photos = isAllView
      ? [...featured, ...rails.flatMap((r) => r.deals)].map((d) => d.primaryPhotoUrl)
      : rest.map((d) => d.primaryPhotoUrl);
    if (photos.length) prefetch.images(photos);
  }, [isAllView, featured, rails, rest, prefetch]);

  // Out-of-area: the feed loaded successfully with ZERO deals near a real,
  // resolved location AND the user hasn't chosen to browse SoCal anyway. We
  // require gpsResolved so we don't flash this during the initial GPS read
  // (the app starts on the San Diego fallback, which does have deals). When
  // the user picks a far city in the picker, location.fromGPS is false but
  // it's still a deliberate location with no deals → also show coming-soon.
  const [browseAnyway, setBrowseAnyway] = useState(false);
  const outOfArea =
    isAllView &&
    !feedQuery.isLoading &&
    !feedQuery.isError &&
    gpsResolved &&
    featured.length === 0 &&
    rails.length === 0 &&
    activeFilterCount === 0 &&
    !browseAnyway;

  const toggleSave = requireAuth('save', (dealId: string) => toggle(dealId));

  // Refresh both the single feed (All view) and the grid (filtered view).
  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRefreshing(true);
    try {
      await Promise.all([
        utils.deals.discoverFeed.invalidate(),
        utils.deals.list.invalidate(),
      ]);
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
          {/* Search bar + square map-view button (ResortPass pattern). The
              location lives INSIDE the search bar as a tappable left segment
              ("📍 City │ Search…") once located — the "where am I searching?"
              answer + tap-to-change affordance (GLO-26), folded into one control
              so it neither collides with the cycling placeholder nor floats on
              its own line. Before a location is set it's omitted (the LocationGate
              takeover below owns that state). No sign-in link here — the Profile
              tab + the auth-gate on buy/save already handle it. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[5] }}>
            <View style={{ flex: 1 }}>
              <SearchBar
                onPress={() => router.push('/(app)/search')}
                {...(hasLocation
                  ? { locationLabel: location.label, onPressLocation: () => setLocationPickerOpen(true) }
                  : {})}
              />
            </View>
            <MapButton onPress={() => router.push('/(app)/map')} />
          </View>

          {/* No location yet → the feed is replaced by a single share-location
              ask (LocationGate). The happy path (located) shows zero location
              chrome; this only ever appears when there's nothing local to show. */}
          {!hasLocation ? <LocationGate /> : (
          <>
          {/* On "All" the Browse-by-category tiles handle navigation, so the
              pill row is hidden (and filtering the whole feed isn't meaningful).
              Inside a category we show the pills (incl. the "All" pill to go
              back), the treatment drill-down, and the Filters button — where
              refining a list actually matters. */}
          {!isAllView ? (
            <View style={{ paddingLeft: space[5], paddingRight: space[3] }}>
              <FilterPills
                selectedSlug={categorySlug}
                onSelect={selectCategory}
                onOpenFilters={() => setFilterSheetOpen(true)}
                activeFilterCount={activeFilterCount}
              />
              {categorySlug ? (
                <TreatmentPills
                  categorySlug={categorySlug}
                  selectedSubtype={subtypeSlug}
                  onSelect={setSubtypeSlug}
                  userLat={location.latitude}
                  userLng={location.longitude}
                  maxDistanceMiles={filters.maxDistanceMiles ?? 50}
                />
              ) : null}
            </View>
          ) : null}

          {/* Thin "updating…" bar ONLY while swapping to new results with old
              ones still on screen — cold start is owned by the big spinner below,
              and we don't show it over the empty / out-of-area states. */}
          {dealsQuery.isFetching && !dealsQuery.isLoading && !outOfArea ? (
            <Stack direction="row" gap={2} align="center" justify="center" style={{ paddingVertical: space[2] }}>
              <ActivityIndicator size="small" color={palette.brand[500]} />
              <Text variant="caption" tone="secondary">
                {location.label === 'Near you' ? 'Finding deals near you…' : `Finding deals near ${location.label}…`}
              </Text>
            </Stack>
          ) : null}

          {/* Feed. While switching with cached data, the old results stay painted
              (dimmed). With no cached data, show the spinner above + skeleton space. */}
          <View
            style={{ opacity: isSwitching ? 0.45 : 1 }}
            pointerEvents={isSwitching ? 'none' : 'auto'}
          >
          {showLoading ? (
            <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
              <ActivityIndicator color={palette.brand[500]} />
            </View>
          ) : activeQuery.isError ? (
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
          ) : isAllView ? (
            /* "All" view — "Browse by category" tiles + a rail per category, all
               from the single discoverFeed response (one round-trip). Featured
               is intentionally omitted for now; it returns when sponsored is a
               paid placement. */
            <Stack gap={8} style={{ marginTop: space[2] }}>
              <BrowseByCategory
                categories={rails.map((r) => ({
                  slug: r.slug,
                  displayName: r.displayName,
                  deals: r.deals,
                  tileImageUrl: r.tileImageUrl,
                }))}
                onSelect={(slug) => setCategorySlug(slug)}
              />

              {rails.map((rail) => (
                <CategoryRail
                  key={rail.slug}
                  label={rail.displayName}
                  deals={rail.deals}
                  savedIds={savedIds}
                  onSave={toggleSave}
                  onSeeAll={() => setCategorySlug(rail.slug)}
                />
              ))}
            </Stack>
          ) : (
            /* Filtered view — 2-up grid of compact square cards. Same square
               photos as the rails (no cropping), just half-width so ~6 listings
               fit per screen instead of one giant card — much better on small
               phones. */
            <View style={{ paddingHorizontal: space[5], marginTop: space[2] }}>
              {rest.length === 0 ? (
                <Text variant="body-md" tone="secondary">
                  No deals match your filters in {location.label}.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                  {rest.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      width={gridCardWidth}
                      isSaved={savedIds.has(deal.id)}
                      onSave={() => toggleSave(deal.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
          </View>
          </>
          )}
        </Stack>
      </ScrollView>

      <FilterSheet
        open={filterSheetOpen}
        initial={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={setFilters}
      />
      <LocationPickerSheet open={locationPickerOpen} onClose={() => setLocationPickerOpen(false)} />
      <StatusBarBackdrop />
    </View>
  );
}
