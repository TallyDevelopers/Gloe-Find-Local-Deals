import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, color, space } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClaimedDealRow } from '../../../features/claimed/ClaimedDealRow';
import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { DealCard } from '../../../features/discover/DealCard';
import { Icon } from '../../../features/icon/Icon';
import { SegmentedControl } from '../../../features/saved/SegmentedControl';
import { useSavedDeals } from '../../../features/saved/SavedDealsProvider';

type Tab = 'saved' | 'mine';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useAuth();
  const { savedIds, toggle, count: savedCount } = useSavedDeals();
  const { activeClaims, pastClaims } = useClaimedDeals();
  const [tab, setTab] = useState<Tab>('saved');

  const dealsQuery = trpc.deals.list.useQuery({ limit: 100 });
  const savedDeals = (dealsQuery.data?.deals ?? []).filter((d) => savedIds.has(d.id));
  const isSignedIn = status === 'signed-in';

  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRefreshing(true);
    try {
      await Promise.all([
        utils.deals.list.invalidate(),
        isSignedIn ? utils.claims.list.invalidate() : Promise.resolve(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [utils, isSignedIn]);

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={color.brand[500]}
          />
        }
      >
        <Stack gap={5}>
          <Stack gap={1}>
            <Text variant="display-lg" tone="primary" weight="medium">
              {tab === 'saved' ? 'Saved' : 'Your deals'}
            </Text>
            <Text variant="body-md" tone="secondary">
              {tab === 'saved'
                ? savedCount === 0
                  ? 'Deals you heart will live here.'
                  : `${savedCount} ${savedCount === 1 ? 'deal' : 'deals'}`
                : activeClaims.length === 0
                  ? 'Active deals ready to redeem.'
                  : `${activeClaims.length} active · ${pastClaims.length} past`}
            </Text>
          </Stack>

          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'saved', label: 'Saved', badge: savedCount },
              { value: 'mine', label: 'Your deals', badge: activeClaims.length },
            ]}
          />

          {tab === 'saved' ? (
            savedDeals.length === 0 ? (
              <SavedEmpty
                isSignedIn={isSignedIn}
                onBrowse={() => router.push('/(app)/(tabs)/discover')}
                onSignIn={() => router.push('/(auth)/login')}
              />
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: space[3],
                }}
              >
                {savedDeals.map((deal) => (
                  <View key={deal.id} style={{ width: '48.5%' }}>
                    <DealCard deal={deal} isSaved onSave={() => toggle(deal.id)} />
                  </View>
                ))}
              </View>
            )
          ) : activeClaims.length === 0 && pastClaims.length === 0 ? (
            <YourDealsEmpty onBrowse={() => router.push('/(app)/(tabs)/discover')} />
          ) : (
            <Stack gap={5}>
              {activeClaims.length > 0 ? (
                <Stack gap={3}>
                  <Text variant="label" tone="tertiary">
                    ACTIVE
                  </Text>
                  <Stack gap={2}>
                    {activeClaims.map((claim) => (
                      <ClaimedDealRow key={claim.id} claim={claim} />
                    ))}
                  </Stack>
                </Stack>
              ) : null}
              {pastClaims.length > 0 ? (
                <Stack gap={3}>
                  <Text variant="label" tone="tertiary">
                    PAST
                  </Text>
                  <Stack gap={2}>
                    {pastClaims.map((claim) => (
                      <ClaimedDealRow key={claim.id} claim={claim} />
                    ))}
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          )}
        </Stack>
      </ScrollView>
    </View>
  );
}

function SavedEmpty({
  isSignedIn,
  onBrowse,
  onSignIn,
}: {
  isSignedIn: boolean;
  onBrowse: () => void;
  onSignIn: () => void;
}) {
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[10] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: color.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="heart" size={44} color={color.brand[500]} strokeWidth={1.75} />
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 300 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          No saved deals yet
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          {isSignedIn
            ? 'Tap the heart on any deal to save it here for later.'
            : 'Sign in to save deals across devices and never miss a flash drop.'}
        </Text>
      </Stack>
      <Stack gap={3} style={{ width: '100%', maxWidth: 320 }}>
        <Button label="Browse deals" onPress={onBrowse} size="lg" fullWidth />
        {!isSignedIn ? (
          <Pressable onPress={onSignIn} style={{ paddingVertical: space[2], alignItems: 'center' }}>
            <Text variant="body-md" tone="link" weight="semibold">
              Sign in
            </Text>
          </Pressable>
        ) : null}
      </Stack>
    </Stack>
  );
}

function YourDealsEmpty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[10] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: color.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 44, color: color.brand[500] }}>✦</Text>
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 300 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          No deals yet
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          When you buy a deal, it shows up here with a code to show at your appointment.
        </Text>
      </Stack>
      <View style={{ width: '100%', maxWidth: 320 }}>
        <Button label="Browse deals" onPress={onBrowse} size="lg" fullWidth />
      </View>
    </Stack>
  );
}
