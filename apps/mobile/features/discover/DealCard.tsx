import type { DealSummary } from '@gloe/api-client';
import { Stack, Text, color, radius, shadow, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Image, Pressable, View } from 'react-native';

import { formatPrice } from './format';

interface DealCardProps {
  deal: DealSummary;
  onSave: () => void;
  isSaved?: boolean;
}

/**
 * Compact grid card. Designed to fit 2 per row on phone widths, image-dominant.
 * Tap anywhere → deal detail. Tap heart → save (gated for anonymous users).
 */
export function DealCard({ deal, onSave, isSaved = false }: DealCardProps) {
  const router = useRouter();
  const variant = deal.headlineVariant;
  if (!variant) return null;

  const discountPct = Math.round(
    ((variant.originalPriceCents - variant.dealPriceCents) / variant.originalPriceCents) * 100,
  );

  const spotsLeft =
    variant.spotsTotal !== null ? variant.spotsTotal - variant.spotsClaimed : null;

  const distanceLabel = formatDistanceLabel(deal.distanceMiles);

  return (
    <Pressable
      onPress={() => router.push(`/(app)/deal/${deal.id}`)}
      style={{
        backgroundColor: color.surface.elevated,
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadow.sm,
      }}
    >
      <View style={{ width: '100%', aspectRatio: 1, position: 'relative' }}>
        {deal.primaryPhotoUrl ? (
          <Image
            source={{ uri: deal.primaryPhotoUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{ width: '100%', height: '100%', backgroundColor: color.neutral[200] }}
          />
        )}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onSave();
          }}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: space[2],
            right: space[2],
            width: 32,
            height: 32,
            borderRadius: radius.pill,
            backgroundColor: color.surface.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.sm,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: isSaved ? color.accent[500] : color.text.primary,
              fontWeight: '600',
            }}
          >
            {isSaved ? '♥' : '♡'}
          </Text>
        </Pressable>
        <View
          style={{
            position: 'absolute',
            top: space[2],
            left: space[2],
            backgroundColor: color.brand[500],
            paddingHorizontal: space[2],
            paddingVertical: 2,
            borderRadius: radius.pill,
          }}
        >
          <Text variant="caption" tone="inverse" weight="semibold">
            {discountPct}% off
          </Text>
        </View>
      </View>

      <View style={{ padding: space[3] }}>
        <Stack gap={1}>
          <Text variant="caption" tone="tertiary" weight="medium" numberOfLines={1}>
            {deal.category.subtypeDisplayName ?? deal.category.displayName}
          </Text>
          <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
            {deal.title}
          </Text>
          {deal.isSponsored ? (
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: space[2],
                paddingVertical: 2,
                borderRadius: radius.sm,
                backgroundColor: color.lavender[50],
                marginTop: 2,
                marginBottom: 2,
              }}
            >
              <Text variant="caption" tone="tertiary" weight="medium">
                Sponsored
              </Text>
            </View>
          ) : null}
          <Stack direction="row" gap={1} align="baseline">
            <Text variant="body-md" tone="primary" weight="semibold">
              {formatPrice(variant.dealPriceCents)}
            </Text>
            <Text
              variant="caption"
              tone="tertiary"
              style={{ textDecorationLine: 'line-through' }}
            >
              {formatPrice(variant.originalPriceCents)}
            </Text>
          </Stack>
          <Stack direction="row" gap={1} align="center">
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {deal.vendor.ratingAvg !== null ? `★ ${deal.vendor.ratingAvg.toFixed(1)} · ` : ''}
              {distanceLabel ?? deal.vendor.city}
            </Text>
          </Stack>
          {spotsLeft !== null && spotsLeft <= 10 ? (
            <Text variant="caption" tone="brand" weight="medium">
              {spotsLeft} spots left
            </Text>
          ) : null}
        </Stack>
      </View>
    </Pressable>
  );
}

function formatDistanceLabel(miles: number | null): string | null {
  if (miles === null) return null;
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
