import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClaimedDealRow } from '../../../features/claimed/ClaimedDealRow';
import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { DealCard } from '../../../features/discover/DealCard';
import { Icon } from '../../../features/icon/Icon';
import { SegmentedControl } from '../../../features/saved/SegmentedControl';
import { useSavedDeals } from '../../../features/saved/SavedDealsProvider';
import { useSavedVendors } from '../../../features/saved/SavedVendorsProvider';

type Tab = 'saved' | 'spas' | 'mine';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useAuth();
  const { color: palette } = useTheme();
  const { savedIds, toggle, count: savedCount } = useSavedDeals();
  const { count: savedVendorCount, toggle: toggleVendor } = useSavedVendors();
  const { activeClaims, pastClaims } = useClaimedDeals();
  const [tab, setTab] = useState<Tab>('saved');

  const dealsQuery = trpc.deals.list.useQuery({ limit: 100 });
  const savedDeals = (dealsQuery.data?.deals ?? []).filter((d) => savedIds.has(d.id));
  const isSignedIn = status === 'signed-in';
  const savedVendorsQuery = trpc.saved.listVendors.useQuery(undefined, {
    enabled: isSignedIn && tab === 'spas',
  });
  const savedVendors = savedVendorsQuery.data ?? [];

  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRefreshing(true);
    try {
      await Promise.all([
        utils.deals.list.invalidate(),
        isSignedIn ? utils.claims.list.invalidate() : Promise.resolve(),
        isSignedIn ? utils.saved.listVendors.invalidate() : Promise.resolve(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [utils, isSignedIn]);

  const headerCopy = (() => {
    if (tab === 'saved') {
      return {
        title: 'Saved',
        sub: savedCount === 0
          ? 'Deals you heart will live here.'
          : `${savedCount} ${savedCount === 1 ? 'deal' : 'deals'}`,
      };
    }
    if (tab === 'spas') {
      return {
        title: 'Spas',
        sub: savedVendorCount === 0
          ? 'Vendors you heart will live here.'
          : `${savedVendorCount} ${savedVendorCount === 1 ? 'spa' : 'spas'}`,
      };
    }
    return {
      title: 'Your deals',
      sub: activeClaims.length === 0
        ? 'Active deals ready to redeem.'
        : `${activeClaims.length} active · ${pastClaims.length} past`,
    };
  })();

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
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
            tintColor={palette.brand[500]}
          />
        }
      >
        <Stack gap={5}>
          <Stack gap={1}>
            <Text variant="display-lg" tone="primary" weight="medium">
              {headerCopy.title}
            </Text>
            <Text variant="body-md" tone="secondary">
              {headerCopy.sub}
            </Text>
          </Stack>

          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'saved', label: 'Saved', badge: savedCount },
              { value: 'spas',  label: 'Spas',  badge: savedVendorCount },
              { value: 'mine',  label: 'Your deals', badge: activeClaims.length },
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
          ) : tab === 'spas' ? (
            savedVendors.length === 0 ? (
              <SavedSpasEmpty
                isSignedIn={isSignedIn}
                onBrowse={() => router.push('/(app)/(tabs)/discover')}
                onSignIn={() => router.push('/(auth)/login')}
              />
            ) : (
              <Stack gap={3}>
                {savedVendors.map((v) => (
                  <SavedVendorCard
                    key={v.vendorId}
                    vendor={v}
                    onPress={() => router.push(`/(app)/vendor/${v.vendorId}`)}
                    onUnsave={() => toggleVendor(v.vendorId)}
                  />
                ))}
              </Stack>
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
  const { color: palette } = useTheme();
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[10] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: palette.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="heart" size={44} color={palette.brand[500]} strokeWidth={1.75} />
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

function SavedSpasEmpty({
  isSignedIn,
  onBrowse,
  onSignIn,
}: {
  isSignedIn: boolean;
  onBrowse: () => void;
  onSignIn: () => void;
}) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[10] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: palette.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="pin" size={44} color={palette.brand[500]} strokeWidth={1.75} />
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 300 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          No saved spas yet
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          {isSignedIn
            ? 'Tap the heart on a vendor page to follow them and get notified about new deals.'
            : 'Sign in to follow your favorite spas and get notified when they drop deals.'}
        </Text>
      </Stack>
      <Stack gap={3} style={{ width: '100%', maxWidth: 320 }}>
        <Button label="Browse deals" onPress={onBrowse} size="lg" fullWidth />
        {!isSignedIn ? (
          <Pressable onPress={onSignIn} style={{ paddingVertical: space[2], alignItems: 'center' }}>
            <Text variant="body-md" tone="link" weight="semibold">Sign in</Text>
          </Pressable>
        ) : null}
      </Stack>
    </Stack>
  );
}

interface SavedVendorCardProps {
  vendor: {
    vendorId: string;
    businessName: string;
    city: string;
    region: string;
    heroImageUrl: string | null;
    ratingAvg: number | null;
    reviewCount: number;
    googleRating: number | null;
    googleReviewCount: number | null;
    activeDealCount: number;
  };
  onPress: () => void;
  onUnsave: () => void;
}

function SavedVendorCard({ vendor, onPress, onUnsave }: SavedVendorCardProps) {
  const { color: palette } = useTheme();
  // Prefer Gloe rating when present, fall back to Google. Show whichever the
  // vendor actually has signal for so the card never reads "no rating yet".
  const displayRating = vendor.ratingAvg ?? vendor.googleRating;
  const displayCount =
    vendor.ratingAvg !== null ? vendor.reviewCount : vendor.googleReviewCount;
  const ratingSource = vendor.ratingAvg !== null ? 'Gloē' : 'Google';
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: space[3],
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        padding: space[3],
        ...shadow.sm,
      }}
    >
      <View style={{
        width: 88, height: 88,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: palette.neutral[200],
      }}>
        {vendor.heroImageUrl ? (
          <Image source={{ uri: vendor.heroImageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
        <View>
          <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
            {vendor.businessName}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {vendor.city}, {vendor.region}
          </Text>
          {displayRating !== null ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              ★ {Number(displayRating).toFixed(1)}{displayCount != null ? ` (${displayCount} on ${ratingSource})` : ''}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="brand" weight="semibold">
          {vendor.activeDealCount > 0
            ? `${vendor.activeDealCount} active ${vendor.activeDealCount === 1 ? 'deal' : 'deals'}`
            : 'No active deals'}
        </Text>
      </View>
      <Pressable
        onPress={(e) => { e.stopPropagation(); onUnsave(); }}
        hitSlop={10}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="heart" size={18} color={palette.accent[500]} fill={palette.accent[500]} strokeWidth={2.25} />
      </Pressable>
    </Pressable>
  );
}

function YourDealsEmpty({ onBrowse }: { onBrowse: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[10] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: palette.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 44, color: palette.brand[500] }}>✦</Text>
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
