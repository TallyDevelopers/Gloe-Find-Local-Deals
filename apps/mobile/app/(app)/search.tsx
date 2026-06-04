import { trpc, type DealSummary } from '@gloe/api-client';
import { Stack, Text, fontFamily, radius, shadow, space, useTheme } from '@gloe/ui';
import { keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../features/auth-gate/useRequireAuth';
import { formatRating, formatDistance } from '../../features/discover/cardMeta';
import { formatPrice } from '../../features/discover/format';
import { useAnonSeed } from '../../features/discover/anonSeed';
import { useSelectedLocation } from '../../features/discover-header/SelectedLocationProvider';
import { Icon } from '../../features/icon/Icon';
import { CachedImage, resizedUrl } from '../../features/image/CachedImage';
import { usePrefetch } from '../../features/prefetch/usePrefetch';
import { useSavedDeals } from '../../features/saved/SavedDealsProvider';

const RECENT_KEY = 'gloe.recentSearches.v1';
const MAX_RECENT = 8;

/**
 * Search — fuzzy, synonym-aware, location-ranked. Type a treatment (or a typo,
 * or slang like "tox"/"skinny shot") and get nearby matches instantly. Backed
 * by deals.search / deals.suggest / deals.trending.
 *
 * Surfaces:
 *  - empty query → recent searches + "popular near you" treatment chips
 *  - typing      → suggestion chips (autocomplete) + live results
 *  - no matches  → never a dead-end; suggests popular treatments instead
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { color: palette } = useTheme();
  const { location } = useSelectedLocation();
  const anonSeed = useAnonSeed();
  const { savedIds } = useSavedDeals();
  const { toggle } = useSavedDeals();
  const requireAuth = useRequireAuth();
  const toggleSave = requireAuth('save', (dealId: string) => toggle(dealId));

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 180);
  const active = debounced.length >= 2;

  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    void loadRecent().then(setRecent);
  }, []);

  const commitRecent = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
      void saveRecent(next);
      return next;
    });
  }, []);

  const loc = { userLat: location.latitude, userLng: location.longitude, maxDistanceMiles: 50 };

  const searchQ = trpc.deals.search.useQuery(
    { q: debounced, ...loc, limit: 30, ...(anonSeed ? { anonSeed } : {}) },
    { enabled: active, placeholderData: keepPreviousData },
  );
  const suggestQ = trpc.deals.suggest.useQuery(
    { q: debounced, userLat: loc.userLat, userLng: loc.userLng, limit: 8 },
    { enabled: active, placeholderData: keepPreviousData },
  );
  const trendingQ = trpc.deals.trending.useQuery({ ...loc, limit: 10 }, { staleTime: 60_000 });

  const results = searchQ.data?.deals ?? [];
  const suggestions = suggestQ.data ?? [];
  const trending = trendingQ.data ?? [];
  const showZero = active && !searchQ.isFetching && results.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      {/* Search header */}
      <View style={{ paddingTop: insets.top + space[3], paddingHorizontal: space[5], paddingBottom: space[3] }}>
        <Stack direction="row" gap={3} align="center">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Icon name="close" size={22} color={palette.text.primary} />
          </Pressable>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              backgroundColor: palette.surface.elevated,
              borderRadius: radius.pill,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              ...shadow.sm,
            }}
          >
            <Icon name="search" size={18} color={palette.text.tertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search Botox, filler, lasers…"
              placeholderTextColor={palette.text.tertiary}
              style={{ flex: 1, fontFamily: fontFamily.body, fontSize: 16, color: palette.text.primary }}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => commitRecent(debounced)}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10}>
                <Icon name="close" size={16} color={palette.text.tertiary} />
              </Pressable>
            ) : null}
          </View>
        </Stack>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: insets.bottom + space[10] }}
      >
        {/* Autocomplete suggestion chips while typing */}
        {active && suggestions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[4] }}>
            {suggestions.map((s) => (
              <Chip
                key={s.subtypeSlug ?? s.term}
                label={s.term}
                onPress={() => {
                  setQuery(s.term);
                  commitRecent(s.term);
                }}
              />
            ))}
          </View>
        ) : null}

        {/* Results */}
        {active ? (
          searchQ.isLoading ? (
            <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
              <ActivityIndicator color={palette.brand[500]} />
            </View>
          ) : showZero ? (
            <ZeroState
              query={debounced}
              trending={trending}
              onPick={(term) => {
                setQuery(term);
                commitRecent(term);
              }}
            />
          ) : (
            <Stack gap={3} style={{ opacity: searchQ.isPlaceholderData ? 0.6 : 1 }}>
              <Text variant="caption" tone="tertiary">
                {results.length} result{results.length === 1 ? '' : 's'}
              </Text>
              {results.map((deal) => (
                <SearchResultRow
                  key={deal.id}
                  deal={deal}
                  isSaved={savedIds.has(deal.id)}
                  onSave={() => toggleSave(deal.id)}
                />
              ))}
            </Stack>
          )
        ) : (
          /* Idle state: recent + trending */
          <Stack gap={6} style={{ marginTop: space[1] }}>
            {recent.length > 0 ? (
              <Stack gap={2}>
                <Stack direction="row" align="center" justify="space-between">
                  <Text variant="label" tone="tertiary">
                    RECENT
                  </Text>
                  <Pressable onPress={() => { setRecent([]); void saveRecent([]); }} hitSlop={8}>
                    <Text variant="caption" tone="link">
                      Clear
                    </Text>
                  </Pressable>
                </Stack>
                {recent.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => setQuery(term)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] }}
                  >
                    <Icon name="clock" size={16} color={palette.text.tertiary} />
                    <Text variant="body-md" tone="primary">
                      {term}
                    </Text>
                  </Pressable>
                ))}
              </Stack>
            ) : null}

            {trending.length > 0 ? (
              <Stack gap={3}>
                <Text variant="label" tone="tertiary">
                  POPULAR NEAR YOU
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                  {trending.map((t) => (
                    <Chip key={t.subtypeSlug ?? t.term} label={t.term} onPress={() => setQuery(t.term)} />
                  ))}
                </View>
              </Stack>
            ) : (
              <Stack gap={2}>
                <Text variant="label" tone="tertiary">
                  TRY SEARCHING FOR
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                  {['Botox', 'Lip filler', 'Microneedling', 'Hydrafacial', 'Weight loss', 'Laser hair removal'].map((term) => (
                    <Chip key={term} label={term} onPress={() => setQuery(term)} />
                  ))}
                </View>
              </Stack>
            )}
          </Stack>
        )}
      </ScrollView>
    </View>
  );
}

/* ─────────────── pieces ─────────────── */

function SearchResultRow({ deal, isSaved, onSave }: { deal: DealSummary; isSaved: boolean; onSave: () => void }) {
  const router = useRouter();
  const { color: palette } = useTheme();
  const prefetch = usePrefetch();
  const variant = deal.headlineVariant;
  const discountPct = variant
    ? Math.round(((variant.originalPriceCents - variant.dealPriceCents) / variant.originalPriceCents) * 100)
    : null;
  const rating = formatRating(deal.vendor);
  const distance = formatDistance(deal.distanceMiles);
  const meta = [deal.vendor.businessName, rating, distance].filter(Boolean).join('  ·  ');

  return (
    <Pressable
      onPressIn={() => prefetch.deal(deal.id)}
      onPress={() => router.push(`/(app)/deal/${deal.id}`)}
      style={{
        flexDirection: 'row',
        gap: space[3],
        padding: space[3],
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        ...shadow.sm,
      }}
    >
      <View style={{ width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: palette.neutral[200] }}>
        {deal.primaryPhotoUrl ? (
          <CachedImage uri={resizedUrl(deal.primaryPhotoUrl, 200)} style={{ width: '100%', height: '100%' }} />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="caption" tone="tertiary" weight="medium" numberOfLines={1}>
          {(deal.category.subtypeDisplayName ?? deal.category.displayName).toUpperCase()}
        </Text>
        <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={2}>
          {deal.title}
        </Text>
        {variant ? (
          <Stack direction="row" gap={2} align="baseline" style={{ marginTop: 2 }}>
            <Text variant="body-md" tone="primary" weight="semibold">
              {formatPrice(variant.dealPriceCents)}
            </Text>
            <Text variant="caption" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
              {formatPrice(variant.originalPriceCents)}
            </Text>
            {discountPct ? (
              <Text variant="caption" tone="brand" weight="semibold">
                {discountPct}% off
              </Text>
            ) : null}
          </Stack>
        ) : null}
        <Text variant="caption" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
          {meta}
        </Text>
      </View>
      <Pressable onPress={(e) => { e.stopPropagation(); onSave(); }} hitSlop={8} style={{ padding: 4 }}>
        <Icon
          name="heart"
          size={18}
          color={isSaved ? palette.accent[500] : palette.text.tertiary}
          fill={isSaved ? palette.accent[500] : 'none'}
          strokeWidth={2.25}
        />
      </Pressable>
    </Pressable>
  );
}

function ZeroState({
  query,
  trending,
  onPick,
}: {
  query: string;
  trending: { term: string; subtypeSlug: string | null }[];
  onPick: (term: string) => void;
}) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={5} style={{ paddingTop: space[6], alignItems: 'center' }}>
      <Icon name="search" size={28} color={palette.text.tertiary} />
      <Stack gap={1} style={{ alignItems: 'center' }}>
        <Text variant="body-lg" tone="primary" weight="semibold">
          No matches for “{query}” nearby
        </Text>
        <Text variant="body-sm" tone="tertiary" align="center">
          Try a different spelling, or one of these popular treatments.
        </Text>
      </Stack>
      {trending.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'center' }}>
          {trending.slice(0, 8).map((t) => (
            <Chip key={t.subtypeSlug ?? t.term} label={t.term} onPress={() => onPick(t.term)} />
          ))}
        </View>
      ) : null}
    </Stack>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space[3],
        paddingVertical: space[2],
        borderRadius: radius.pill,
        backgroundColor: palette.surface.elevated,
        borderWidth: 1,
        borderColor: palette.border.subtle,
      }}
    >
      <Text variant="body-sm" tone="primary" weight="medium">
        {label}
      </Text>
    </Pressable>
  );
}

/* ─────────────── helpers ─────────────── */

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function loadRecent(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function saveRecent(list: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // SecureStore can fail on simulators without keychain — non-fatal.
  }
}
