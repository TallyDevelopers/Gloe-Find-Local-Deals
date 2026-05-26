import { trpc, type DealVariant } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, Share, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { CustomerVideos } from '../../../features/deal-detail/CustomerVideos';
import { HeroImage } from '../../../features/deal-detail/HeroImage';
import { RedemptionMap } from '../../../features/deal-detail/RedemptionMap';
import { ReviewsSection } from '../../../features/deal-detail/ReviewsSection';
import { Section } from '../../../features/deal-detail/Section';
import { StickyActionBar } from '../../../features/deal-detail/StickyActionBar';
import { StickyTopBar } from '../../../features/deal-detail/StickyTopBar';
import { VariantPicker } from '../../../features/deal-detail/VariantPicker';
import { formatPrice } from '../../../features/discover/format';
import { useSavedDeals } from '../../../features/saved/SavedDealsProvider';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status } = useAuth();
  const { color: palette } = useTheme();
  const requireAuth = useRequireAuth();
  const { isSaved: getIsSaved, toggle: toggleSavedGlobal } = useSavedDeals();

  const dealQuery = trpc.deals.byId.useQuery({ id: id ?? '' }, { enabled: !!id });
  const reviewsQuery = trpc.reviews.listForVendor.useQuery(
    { vendorId: dealQuery.data?.vendor.id ?? '', limit: 3 },
    { enabled: !!dealQuery.data?.vendor.id },
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

  // Hero is a 3:2 image; the sticky top bar fades its background in past it.
  const heroHeight = Dimensions.get('window').width * (2 / 3);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const deal = dealQuery.data;
  const isSaved = id ? getIsSaved(id) : false;

  const selectedVariant: DealVariant | undefined = useMemo(() => {
    if (!deal) return undefined;
    return deal.variants.find((v) => v.id === selectedVariantId) ?? deal.variants[0];
  }, [deal, selectedVariantId]);

  if (dealQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={palette.brand[500]} />
      </View>
    );
  }

  if (!deal || !selectedVariant) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space[6],
        }}
      >
        <Stack gap={3} align="center">
          <Text variant="display-sm" tone="primary">
            Deal not found
          </Text>
          <Text variant="body-md" tone="secondary" align="center">
            This deal may have expired or been removed.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: space[3], paddingHorizontal: space[5] }}
          >
            <Text variant="body-md" tone="link" weight="semibold">
              Go back
            </Text>
          </Pressable>
        </Stack>
      </View>
    );
  }

  const discountPct = Math.round(
    ((selectedVariant.originalPriceCents - selectedVariant.dealPriceCents) /
      selectedVariant.originalPriceCents) *
      100,
  );
  const dollarsSaved =
    (selectedVariant.originalPriceCents - selectedVariant.dealPriceCents) / 100;
  const spotsLeft =
    selectedVariant.spotsTotal !== null
      ? selectedVariant.spotsTotal - selectedVariant.spotsClaimed
      : null;
  const primaryProvider = deal.providers[0] ?? null;
  const galleryUrls = deal.photos.map((p) => p.url);

  const handleSave = requireAuth('save', () => {
    if (id) toggleSavedGlobal(id);
  });
  const handleRedeem = requireAuth('redeem', () =>
    router.push({
      pathname: '/(app)/checkout',
      params: {
        dealId: deal.id,
        title: deal.title,
        categoryLabel: deal.category.subtypeDisplayName
          ? `${deal.category.displayName} · ${deal.category.subtypeDisplayName}`
          : deal.category.displayName,
        vendorName: deal.vendor.businessName,
        vendorRating: deal.vendor.ratingAvg != null ? String(deal.vendor.ratingAvg) : '',
        vendorReviews: String(deal.vendor.reviewCount ?? 0),
        photoUrl: galleryUrls[0] ?? '',
        variantId: selectedVariant.id,
        variantLabel: selectedVariant.label,
        originalPriceCents: String(selectedVariant.originalPriceCents),
        dealPriceCents: String(selectedVariant.dealPriceCents),
        discountPct: String(discountPct),
        spotsLeft: spotsLeft != null ? String(spotsLeft) : '',
        expiresAt: deal.expiresAt ?? '',
        perCustomerLimit: String(deal.perCustomerLimit ?? 1),
      },
    }),
  );
  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Pass `url` only — iOS auto-fetches OG tags from the page and renders
      // a rich preview card in iMessage/WhatsApp/etc. Adding `message` here
      // would force a plain-text concat and kill the preview.
      const result = await Share.share({ url: `https://gloe.app/deal/${deal.id}` });
      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const ctaLabel = status === 'signed-in' ? 'Buy now' : 'Sign in to buy now';

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <StickyTopBar scrollY={scrollY} heroHeight={heroHeight} />
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <HeroImage images={galleryUrls} />

        <View style={{ paddingHorizontal: space[5], paddingTop: space[5] }}>
          <Stack gap={6}>
            <Stack gap={3}>
              <Text variant="caption" tone="tertiary" weight="medium">
                {deal.category.displayName.toUpperCase()}
                {deal.category.subtypeDisplayName ? ` · ${deal.category.subtypeDisplayName}` : ''}
              </Text>
              <Text variant="display-lg" tone="primary" weight="medium">
                {deal.title}
              </Text>

              <Pressable
                onPress={() => router.push(`/(app)/vendor/${deal.vendor.id}`)}
                style={{ paddingVertical: space[1] }}
              >
                <Stack direction="row" gap={2} align="center">
                  <Text variant="body-md" tone="primary" weight="semibold">
                    {deal.vendor.businessName}
                  </Text>
                  {deal.vendor.ratingAvg !== null ? (
                    <Text variant="body-sm" tone="secondary">
                      ★ {deal.vendor.ratingAvg.toFixed(1)} ({deal.vendor.reviewCount})
                    </Text>
                  ) : null}
                  {deal.distanceMiles !== null ? (
                    <Text variant="body-sm" tone="tertiary">
                      · {deal.distanceMiles.toFixed(1)} mi
                    </Text>
                  ) : null}
                </Stack>
              </Pressable>
            </Stack>

            <VariantPicker
              variants={deal.variants}
              selectedId={selectedVariant.id}
              onSelect={setSelectedVariantId}
            />

            <View
              style={{
                backgroundColor: palette.surface.elevated,
                borderRadius: radius.lg,
                padding: space[5],
                gap: space[2],
              }}
            >
              <Stack direction="row" align="baseline" gap={3}>
                <Text variant="display-lg" tone="primary" weight="semibold">
                  {formatPrice(selectedVariant.dealPriceCents)}
                </Text>
                <Text variant="body-lg" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
                  {formatPrice(selectedVariant.originalPriceCents)}
                </Text>
                <View
                  style={{
                    backgroundColor: palette.brand[500],
                    paddingHorizontal: space[3],
                    paddingVertical: space[1],
                    borderRadius: radius.pill,
                  }}
                >
                  <Text variant="body-sm" tone="inverse" weight="semibold">
                    {discountPct}% off
                  </Text>
                </View>
              </Stack>
              <Text variant="body-sm" tone="secondary">
                You save ${dollarsSaved.toFixed(0)}
                {selectedVariant.unitCount && selectedVariant.unitLabel
                  ? ` · ${selectedVariant.unitCount} ${selectedVariant.unitLabel}`
                  : ''}
              </Text>
            </View>

            <Stack direction="row" gap={4} align="center">
              {spotsLeft !== null ? (
                <Text variant="body-md" tone="brand" weight="semibold">
                  {spotsLeft} spots left
                </Text>
              ) : null}
              <Text variant="body-md" tone="secondary">
                Expires {formatExpiry(deal.expiresAt)}
              </Text>
            </Stack>

            <Section title="About this treatment">
              <Text variant="body-md" tone="secondary">
                {deal.description}
              </Text>
            </Section>

            <Section title="What's included">
              <Stack gap={2}>
                {deal.whatsIncluded.map((item) => (
                  <Stack key={item} direction="row" gap={3} align="flex-start">
                    <Text variant="body-md" tone="brand" weight="semibold">✓</Text>
                    <Text variant="body-md" tone="secondary" style={{ flex: 1 }}>
                      {item}
                    </Text>
                  </Stack>
                ))}
              </Stack>
            </Section>

            {primaryProvider ? (
              <Section title="Your provider">
                <Stack direction="row" gap={4} align="flex-start">
                  {primaryProvider.photoUrl ? (
                    <Image
                      source={{ uri: primaryProvider.photoUrl }}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: palette.neutral[200],
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: palette.brand[100],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="display-sm" tone="brand" weight="semibold">
                        {primaryProvider.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <Stack gap={2} flex={1}>
                    <Stack direction="row" gap={2} align="baseline">
                      <Text variant="body-lg" tone="primary" weight="semibold">
                        {primaryProvider.name}
                      </Text>
                      <Text variant="body-sm" tone="tertiary">
                        {primaryProvider.title}
                      </Text>
                    </Stack>
                    {primaryProvider.bio ? (
                      <Text variant="body-md" tone="secondary">
                        {primaryProvider.bio}
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              </Section>
            ) : null}

            <CustomerVideos
              videos={deal.videos.map((v) => ({
                id: v.id,
                thumbnailUrl: v.thumbnailUrl,
                caption: v.caption ?? undefined,
                duration: v.durationSeconds ? formatDuration(v.durationSeconds) : undefined,
              }))}
              vendorName={deal.vendor.businessName}
            />

            <Section title="Where you'll go">
              <Stack gap={3}>
                <Text variant="body-md" tone="primary" weight="medium">
                  {deal.vendor.businessName}
                  {deal.vendor.hoursSummary ? (
                    <Text variant="body-sm" tone="tertiary">{`  ·  ${deal.vendor.hoursSummary}`}</Text>
                  ) : null}
                </Text>
                <RedemptionMap redemption={deal.redemption} vendorName={deal.vendor.businessName} />
              </Stack>
            </Section>

            <ReviewsSection
              vendorId={deal.vendor.id}
              googlePlaceId={deal.vendor.googlePlaceId}
              reviewCount={deal.vendor.reviewCount}
              internalReviews={reviewsQuery.data ?? []}
            />

            <Section title="The fine print">
              <Stack gap={2}>
                {deal.restrictions.map((r) => (
                  <Stack key={r} direction="row" gap={3} align="flex-start">
                    <Text variant="body-md" tone="tertiary">·</Text>
                    <Text variant="body-sm" tone="tertiary" style={{ flex: 1 }}>
                      {r}
                    </Text>
                  </Stack>
                ))}
                <Text variant="caption" tone="tertiary" style={{ marginTop: space[2] }}>
                  Treatments performed by licensed independent providers. Gloe is a marketplace
                  platform and does not provide medical services.
                </Text>
              </Stack>
            </Section>
          </Stack>
        </View>
      </Animated.ScrollView>

      <StickyActionBar
        isSaved={isSaved}
        onSave={handleSave}
        onShare={handleShare}
        onRedeem={handleRedeem}
        ctaLabel={ctaLabel}
      />

    </View>
  );
}

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'soon';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

