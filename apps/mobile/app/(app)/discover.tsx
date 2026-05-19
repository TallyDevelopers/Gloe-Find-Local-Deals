import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, color, space } from '@gloe/ui';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireAuth } from '../../features/auth-gate/useRequireAuth';
import { DealCard } from '../../features/discover/DealCard';
import { FeaturedCarousel } from '../../features/discover/FeaturedCarousel';
import { useSavedDeals } from '../../features/saved/SavedDealsProvider';

// Downtown San Diego — placeholder until real GPS / city selector wires in
const FALLBACK_LAT = 32.7157;
const FALLBACK_LNG = -117.1611;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { status, user } = useAuth();
  const requireAuth = useRequireAuth();
  const { savedIds, toggle } = useSavedDeals();

  const dealsQuery = trpc.deals.list.useQuery({
    userLat: FALLBACK_LAT,
    userLng: FALLBACK_LNG,
    maxDistanceMiles: 50,
    limit: 50,
  });

  const isSignedIn = status === 'signed-in';
  const allDeals = dealsQuery.data ?? [];
  const featured = allDeals.filter((d) => d.isSponsored);
  const rest = allDeals;

  const toggleSave = requireAuth('save', (dealId: string) => {
    toggle(dealId);
  });

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={6}>
          <Stack direction="row" justify="space-between" align="center" paddingX={5}>
            <Text variant="display-lg" tone="primary" weight="medium">
              Gloe
            </Text>
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

          <Stack gap={1} paddingX={5}>
            <Text variant="display-md" tone="primary" weight="medium">
              {isSignedIn ? `Hi, ${user?.firstName ?? 'there'}` : 'Find your glow.'}
            </Text>
            <Text variant="body-md" tone="secondary">
              {isSignedIn
                ? 'Deals near you, hand-picked.'
                : 'Browse local aesthetic deals. Sign in to claim.'}
            </Text>
          </Stack>

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
          ) : (
            <>
              {featured.length > 0 ? (
                <View style={{ paddingLeft: space[5] }}>
                  <FeaturedCarousel deals={featured} onSave={toggleSave} savedIds={savedIds} />
                </View>
              ) : null}

              <Stack gap={3} paddingX={5}>
                <Text variant="display-sm" tone="primary" weight="medium">
                  Near you
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
                  {rest.map((deal) => (
                    <View key={deal.id} style={{ width: '48.5%' }}>
                      <DealCard
                        deal={deal}
                        isSaved={savedIds.has(deal.id)}
                        onSave={() => toggleSave(deal.id)}
                      />
                    </View>
                  ))}
                </View>
              </Stack>
            </>
          )}
        </Stack>
      </ScrollView>
    </View>
  );
}
