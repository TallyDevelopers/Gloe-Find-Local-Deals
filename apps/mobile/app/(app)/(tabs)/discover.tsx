import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, color, space } from '@gloe/ui';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { CategoryRail } from '../../../features/discover/CategoryRail';
import { DealCardLarge } from '../../../features/discover/DealCardLarge';
import { FeaturedCarousel } from '../../../features/discover/FeaturedCarousel';
import { CATEGORY_OPTIONS, FilterPills } from '../../../features/discover-header/FilterPills';
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

  const [categorySlug, setCategorySlug] = useState<string | null>(null);

  // Featured (sponsored) carousel + the filtered grid both read this query.
  // When "All" is selected the body shows category rails instead of the grid.
  const dealsQuery = trpc.deals.list.useQuery({
    userLat: location.latitude,
    userLng: location.longitude,
    maxDistanceMiles: 50,
    limit: 50,
    ...(categorySlug ? { category: categorySlug } : {}),
  });

  const isSignedIn = status === 'signed-in';
  const allDeals = dealsQuery.data?.deals ?? [];
  const featured = allDeals.filter((d) => d.isSponsored);
  const rest = allDeals;

  const toggleSave = requireAuth('save', (dealId: string) => toggle(dealId));

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[3],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
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
              onOpenFilters={() => {
                // TODO: open advanced filters sheet (distance, price, rating)
              }}
            />
          </View>

          {/* Feed */}
          {dealsQuery.isLoading ? (
            <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
              <ActivityIndicator color={color.brand[500]} />
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
    </View>
  );
}
