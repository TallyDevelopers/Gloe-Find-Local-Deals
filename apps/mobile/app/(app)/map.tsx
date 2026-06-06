import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { keepPreviousData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAnonSeed } from '../../features/discover/anonSeed';
import { CategoryTabs } from '../../features/discover-header/CategoryTabs';
import { LocationPickerSheet } from '../../features/discover-header/LocationPickerSheet';
import { useSelectedLocation } from '../../features/discover-header/SelectedLocationProvider';
import { Icon } from '../../features/icon/Icon';
import { ClusterMarker, SpaMarker } from '../../features/map-discovery/MapPin';
import { MapBrowseSheet, type MapBrowseSheetHandle } from '../../features/map-discovery/MapBrowseSheet';
import { MapFilterChips } from '../../features/map-discovery/MapFilterChips';
import { MapFilterSheet, type FilterFocus } from '../../features/map-discovery/MapFilterSheet';
import { EMPTY_MAP_FILTERS, type MapFilters } from '../../features/map-discovery/mapFilters';
import { clusterPins, zoomInto } from '../../features/map-discovery/clustering';
import { groupDealsBySpa, type SpaPin } from '../../features/map-discovery/spaGrouping';
import { useSavedDeals } from '../../features/saved/SavedDealsProvider';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GUTTER = 16;
const CARD_WIDTH = SCREEN_W - CARD_GUTTER * 2;
const CARD_SNAP = CARD_WIDTH + space[3];

/** A region centered on a point with a span derived from a miles radius. */
function regionFromLocation(lat: number, lng: number, radiusMiles = 12): Region {
  // ~69 miles per degree latitude; widen a touch so pins aren't on the edge.
  const latDelta = (radiusMiles / 69) * 2;
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: latDelta,
    longitudeDelta: latDelta,
  };
}

/** Approx visible radius (miles) from a region's latitude span — for re-query. */
function radiusMilesFor(region: Region): number {
  return Math.max((region.latitudeDelta / 2) * 69, 2);
}

/**
 * Full-screen map discovery (GLO-25), ResortPass-style:
 *  - opens centered on the user's current browse location ("near me")
 *  - category tabs + filter row across the top
 *  - one teal pin per spa, clustered when zoomed out, active pin darkened
 *  - swipeable bottom card carousel two-way synced to the pins
 *  - "Search this area" re-queries for the visible map center
 *
 * iOS-first (Android is a deliberate fast-follow, per the ticket).
 */
export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const { status } = useAuth();
  const { location } = useSelectedLocation();
  const anonSeed = useAnonSeed();
  const { savedIds, toggle } = useSavedDeals();

  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList<SpaPin>>(null);
  const sheetRef = useRef<MapBrowseSheetHandle>(null);

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // The map's full filter state (vibe/price/rating/sort/distance) — maps 1:1
  // onto deals.list inputs. Opened from the chip row via `filterFocus`.
  const [filters, setFilters] = useState<MapFilters>(EMPTY_MAP_FILTERS);
  const [filterFocus, setFilterFocus] = useState<FilterFocus | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  // Y where the static header ends — the full sheet detent stops just below it.
  const [headerBottom, setHeaderBottom] = useState(insets.top + 132);

  // The region we LOOK at vs. the center we QUERY for. We only re-query when the
  // user taps "Search this area" — panning the map shouldn't spam the backend.
  const initialRegion = useMemo(
    () => regionFromLocation(location.latitude, location.longitude),
    [location.latitude, location.longitude],
  );
  const [region, setRegion] = useState<Region>(initialRegion);
  const [queryCenter, setQueryCenter] = useState({
    lat: location.latitude,
    lng: location.longitude,
    radiusMiles: 12,
  });
  // True when the visible region has drifted from the last queried center.
  const [areaDirty, setAreaDirty] = useState(false);

  // When the browse location changes (user picked a city / shared GPS), fly the
  // map there and re-query around it. Keyed on coords so it only fires on a real
  // change, not every render.
  useEffect(() => {
    const next = regionFromLocation(location.latitude, location.longitude);
    mapRef.current?.animateToRegion(next, 400);
    setQueryCenter({ lat: location.latitude, lng: location.longitude, radiusMiles: 12 });
    setAreaDirty(false);
    setActiveIndex(0);
  }, [location.latitude, location.longitude]);

  const isSignedIn = status === 'signed-in';
  const identityReady = isSignedIn || anonSeed !== null;

  const dealsQuery = trpc.deals.list.useQuery(
    {
      userLat: queryCenter.lat,
      userLng: queryCenter.lng,
      // A filter-set distance overrides the visible-area radius.
      maxDistanceMiles: filters.maxDistanceMiles ?? queryCenter.radiusMiles,
      limit: 100,
      ...(categorySlug ? { category: categorySlug } : {}),
      ...(filters.minPriceCents !== undefined ? { minPriceCents: filters.minPriceCents } : {}),
      ...(filters.maxPriceCents !== undefined ? { maxPriceCents: filters.maxPriceCents } : {}),
      ...(filters.minDiscountPct !== undefined ? { minDiscountPct: filters.minDiscountPct } : {}),
      ...(filters.minRating !== undefined ? { minRating: filters.minRating } : {}),
      ...(filters.vibes.length > 0 ? { vibes: filters.vibes } : {}),
      ...(filters.sort !== undefined ? { sort: filters.sort } : {}),
      ...(anonSeed ? { anonSeed } : {}),
    },
    { placeholderData: keepPreviousData, enabled: identityReady },
  );

  const deals = dealsQuery.data?.deals ?? [];
  const spas = useMemo(() => groupDealsBySpa(deals), [deals]);
  const items = useMemo(() => clusterPins(spas, region), [spas, region]);

  const activeVendorId = spas[activeIndex]?.vendorId ?? null;

  // Swiping a card → center its pin (and keep the active highlight in sync).
  const onCardScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_SNAP);
      if (idx === activeIndex || idx < 0 || idx >= spas.length) return;
      setActiveIndex(idx);
      const spa = spas[idx];
      if (spa) {
        mapRef.current?.animateToRegion(
          { latitude: spa.lat, longitude: spa.lng, latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta },
          280,
        );
      }
    },
    [activeIndex, spas, region.latitudeDelta, region.longitudeDelta],
  );

  // Tapping a pin → scroll its card into view.
  const focusSpa = useCallback(
    (vendorId: string) => {
      const idx = spas.findIndex((s) => s.vendorId === vendorId);
      if (idx < 0) return;
      Haptics.selectionAsync();
      // Bring the sheet back to the cards detent so the tapped spa's card shows.
      sheetRef.current?.collapse();
      setActiveIndex(idx);
      listRef.current?.scrollToOffset({ offset: idx * CARD_SNAP, animated: true });
      const spa = spas[idx];
      if (spa) {
        mapRef.current?.animateToRegion(
          { latitude: spa.lat, longitude: spa.lng, latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta },
          280,
        );
      }
    },
    [spas, region.latitudeDelta, region.longitudeDelta],
  );

  const searchThisArea = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueryCenter({ lat: region.latitude, lng: region.longitude, radiusMiles: radiusMilesFor(region) });
    setAreaDirty(false);
    setActiveIndex(0);
  }, [region]);

  const selectCategory = useCallback((slug: string | null) => {
    setCategorySlug(slug);
    setActiveIndex(0);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        onRegionChangeComplete={(r) => {
          setRegion(r);
          setAreaDirty(true);
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {items.map((item) =>
          item.kind === 'pin' ? (
            <Marker
              key={item.pin.vendorId}
              coordinate={{ latitude: item.lat, longitude: item.lng }}
              onPress={() => focusSpa(item.pin.vendorId)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <SpaMarker active={item.pin.vendorId === activeVendorId} />
            </Marker>
          ) : (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.lat, longitude: item.lng }}
              onPress={() =>
                mapRef.current?.animateToRegion(zoomInto(item.lat, item.lng, region), 300)
              }
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <ClusterMarker count={item.count} />
            </Marker>
          ),
        )}
      </MapView>

      {/* ── Static top chrome: location row · scrollable service pills ·
             filter chip row. Pinned above everything (and the full sheet
             detent stops just below it). ──────────────────────────────── */}
      <View
        onLayout={(e) => setHeaderBottom(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + space[2],
          paddingBottom: space[2],
          backgroundColor: palette.surface.primary,
          ...shadow.sm,
        }}
      >
        {/* Row 1 — back + location (static). */}
        <Stack direction="row" align="center" gap={2} style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Close map"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              backgroundColor: palette.surface.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              ...shadow.sm,
            }}
          >
            <Icon name="chevronLeft" size={20} color={palette.text.primary} />
          </Pressable>
          {/* Tappable location — opens the city picker (change where you're
              browsing; the map re-centers on the new location). */}
          <Pressable
            onPress={() => setLocationPickerOpen(true)}
            hitSlop={8}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[1] }}
          >
            <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
              {location.label}
            </Text>
            <Icon name="chevronDown" size={16} color={palette.text.tertiary} strokeWidth={2.5} />
          </Pressable>
        </Stack>

        {/* Row 2 — category tabs (All · Injectables · Skin · …), underline style. */}
        <CategoryTabs selectedSlug={categorySlug} onSelect={selectCategory} />

        {/* Row 3 — filter pills that refine the category (Filter · Vibe · …). */}
        <View style={{ paddingLeft: space[4], paddingTop: space[2] }}>
          <MapFilterChips filters={filters} onOpen={setFilterFocus} />
        </View>
      </View>

      {/* ── "Search this area" pill, floats over the map ───────────────── */}
      {areaDirty ? (
        <Pressable
          onPress={searchThisArea}
          style={{
            position: 'absolute',
            top: headerBottom + space[3],
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            backgroundColor: palette.surface.elevated,
            paddingHorizontal: space[4],
            paddingVertical: space[2],
            borderRadius: radius.pill,
            ...shadow.md,
          }}
        >
          {dealsQuery.isFetching ? (
            <ActivityIndicator size="small" color={palette.brand[500]} />
          ) : (
            <Icon name="search" size={15} color={palette.text.primary} strokeWidth={2.25} />
          )}
          <Text variant="body-sm" tone="primary" weight="semibold">
            Search this area
          </Text>
        </Pressable>
      ) : null}

      {/* ── Bottom: 3-detent sheet — cards → map+list → full list ──────── */}
      <MapBrowseSheet
        ref={sheetRef}
        spas={spas}
        isLoading={dealsQuery.isLoading}
        cardWidth={CARD_WIDTH}
        cardSnap={CARD_SNAP}
        cardGutter={CARD_GUTTER}
        listRef={listRef}
        onCardSettle={onCardScroll}
        savedIds={savedIds}
        onToggleSave={toggle}
        bottomInset={insets.bottom + space[2]}
        headerBottom={headerBottom}
      />

      {/* ── Filter sheet — opened from any chip, focused on its section ─── */}
      <MapFilterSheet
        open={filterFocus !== null}
        focus={filterFocus ?? 'all'}
        initial={filters}
        onClose={() => setFilterFocus(null)}
        onApply={(next) => {
          setFilters(next);
          setActiveIndex(0);
        }}
      />

      {/* Change-location picker (opened from the tappable location label). */}
      <LocationPickerSheet open={locationPickerOpen} onClose={() => setLocationPickerOpen(false)} />
    </View>
  );
}
