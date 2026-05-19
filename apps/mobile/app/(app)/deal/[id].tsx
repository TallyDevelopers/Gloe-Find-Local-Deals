import { trpc, type DealVariant } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Stack, Text, color, radius, space } from '@gloe/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';

import { useRequireAuth } from '../../../features/auth-gate/useRequireAuth';
import { ClaimConfirmSheet } from '../../../features/claimed/ClaimConfirmSheet';
import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { CustomerVideos } from '../../../features/deal-detail/CustomerVideos';
import { HeroImage } from '../../../features/deal-detail/HeroImage';
import { Section } from '../../../features/deal-detail/Section';
import { StickyActionBar } from '../../../features/deal-detail/StickyActionBar';
import { VariantPicker } from '../../../features/deal-detail/VariantPicker';
import { formatPrice } from '../../../features/discover/format';
import { useSavedDeals } from '../../../features/saved/SavedDealsProvider';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status } = useAuth();
  const requireAuth = useRequireAuth();
  const { isSaved: getIsSaved, toggle: toggleSavedGlobal } = useSavedDeals();
  const { activeClaims } = useClaimedDeals();

  const dealQuery = trpc.deals.byId.useQuery({ id: id ?? '' }, { enabled: !!id });
  const reviewsQuery = trpc.reviews.listForVendor.useQuery(
    { vendorId: dealQuery.data?.vendor.id ?? '', limit: 3 },
    { enabled: !!dealQuery.data?.vendor.id },
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
          backgroundColor: color.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={color.brand[500]} />
      </View>
    );
  }

  if (!deal || !selectedVariant) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.surface.primary,
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
  const handleRedeem = requireAuth('redeem', () => setConfirmOpen(true));
  const handleShare = () => console.log('Share', deal.id);

  const ctaLabel = status === 'signed-in' ? 'Get this deal' : 'Sign in to claim';

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <HeroImage images={galleryUrls} isSaved={isSaved} onSave={handleSave} onShare={handleShare} />

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
                backgroundColor: color.surface.elevated,
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
                    backgroundColor: color.brand[500],
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
                        backgroundColor: color.neutral[200],
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 36,
                        backgroundColor: color.brand[100],
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

            <Section
              title="Where"
              action={
                <Pressable hitSlop={8}>
                  <Text variant="body-sm" tone="link" weight="semibold">
                    Directions →
                  </Text>
                </Pressable>
              }
            >
              <Stack gap={1}>
                <Text variant="body-md" tone="primary" weight="medium">
                  {deal.vendor.businessName}
                </Text>
                <Text variant="body-md" tone="secondary">
                  {deal.vendor.address}
                </Text>
                <Text variant="body-sm" tone="tertiary">
                  {deal.vendor.city}
                  {deal.vendor.hoursSummary ? ` · ${deal.vendor.hoursSummary}` : ''}
                </Text>
              </Stack>
            </Section>

            <Section
              title="Reviews"
              action={
                deal.vendor.reviewCount > 0 ? (
                  <Pressable hitSlop={8}>
                    <Text variant="body-sm" tone="link" weight="semibold">
                      See all {deal.vendor.reviewCount} →
                    </Text>
                  </Pressable>
                ) : undefined
              }
            >
              {reviewsQuery.data && reviewsQuery.data.length > 0 ? (
                <Stack gap={4}>
                  {reviewsQuery.data.map((review) => (
                    <Stack key={review.id} gap={1}>
                      <Stack direction="row" gap={2} align="baseline">
                        <Text variant="body-md" tone="primary" weight="semibold">
                          {review.authorFirstName ?? 'Member'}
                        </Text>
                        <Text variant="body-sm" tone="brand">
                          {'★'.repeat(review.rating)}
                        </Text>
                      </Stack>
                      {review.body ? (
                        <Text variant="body-md" tone="secondary">
                          {review.body}
                        </Text>
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Text variant="body-sm" tone="tertiary">
                  No reviews yet. Be the first after your appointment.
                </Text>
              )}
            </Section>

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
      </ScrollView>

      <StickyActionBar
        isSaved={isSaved}
        onSave={handleSave}
        onShare={handleShare}
        onRedeem={handleRedeem}
        ctaLabel={ctaLabel}
      />

      <ClaimConfirmSheet
        deal={
          confirmOpen
            ? {
                id: deal.id,
                title: deal.title,
                categoryLabel: deal.category.subtypeDisplayName
                  ? `${deal.category.displayName} · ${deal.category.subtypeDisplayName}`
                  : deal.category.displayName,
                vendorName: deal.vendor.businessName,
                vendorContextLine:
                  deal.distanceMiles !== null
                    ? `${deal.distanceMiles.toFixed(1)} mi`
                    : deal.vendor.city,
              }
            : null
        }
        variant={
          confirmOpen
            ? {
                id: selectedVariant.id,
                label: selectedVariant.label,
                originalPriceCents: selectedVariant.originalPriceCents,
                dealPriceCents: selectedVariant.dealPriceCents,
              }
            : null
        }
        monthlyUsed={activeClaims.length}
        monthlyLimit={5}
        onClose={() => setConfirmOpen(false)}
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

