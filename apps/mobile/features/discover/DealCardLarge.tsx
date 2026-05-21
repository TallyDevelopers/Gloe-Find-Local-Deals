import type { DealSummary } from '@gloe/api-client';
import { Stack, Text, color, radius, shadow, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Dimensions, Image, Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';
import { formatPrice } from './format';

// Image height tuned so a centered card leaves a peek of the next one below,
// without pushing the price/vendor line off-screen.
const IMG_HEIGHT = Math.round(Dimensions.get('window').height * 0.46);

interface DealCardLargeProps {
  deal: DealSummary;
  onSave: () => void;
  isSaved?: boolean;
}

/**
 * Full-width deal card for the filtered "view all" feed. Larger image + more
 * info than the grid/rail card — fills the screen nicely when a category has
 * only a few deals, and lets each post show more at a glance.
 */
export function DealCardLarge({ deal, onSave, isSaved = false }: DealCardLargeProps) {
  const router = useRouter();
  const variant = deal.headlineVariant;
  if (!variant) return null;

  const discountPct = Math.round(
    ((variant.originalPriceCents - variant.dealPriceCents) / variant.originalPriceCents) * 100,
  );
  const spotsLeft = variant.spotsTotal !== null ? variant.spotsTotal - variant.spotsClaimed : null;
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
      <View style={{ width: '100%', height: IMG_HEIGHT, position: 'relative' }}>
        {deal.primaryPhotoUrl ? (
          <Image source={{ uri: deal.primaryPhotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: color.neutral[200] }} />
        )}

        <View
          style={{
            position: 'absolute',
            top: space[3],
            left: space[3],
            backgroundColor: color.brand[500],
            paddingHorizontal: space[3],
            paddingVertical: 3,
            borderRadius: radius.pill,
          }}
        >
          <Text variant="body-sm" tone="inverse" weight="semibold">
            {discountPct}% off
          </Text>
        </View>

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onSave();
          }}
          hitSlop={8}
          style={{
            position: 'absolute',
            top: space[3],
            right: space[3],
            width: 38,
            height: 38,
            borderRadius: radius.pill,
            backgroundColor: color.surface.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.sm,
          }}
        >
          <Icon
            name="heart"
            size={18}
            color={isSaved ? color.accent[500] : color.text.primary}
            fill={isSaved ? color.accent[500] : 'none'}
            strokeWidth={2.25}
          />
        </Pressable>

        {deal.isSponsored ? (
          <View
            style={{
              position: 'absolute',
              bottom: space[3],
              left: space[3],
              backgroundColor: 'rgba(43,32,25,0.6)',
              paddingHorizontal: space[2],
              paddingVertical: 2,
              borderRadius: radius.sm,
            }}
          >
            <Text variant="caption" tone="inverse" weight="medium">
              Sponsored
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: space[4] }}>
        <Stack gap={2}>
          <Text variant="caption" tone="tertiary" weight="medium">
            {(deal.category.subtypeDisplayName ?? deal.category.displayName).toUpperCase()}
          </Text>
          <Text variant="display-sm" tone="primary" weight="medium" numberOfLines={2}>
            {deal.title}
          </Text>

          <Stack direction="row" gap={2} align="baseline">
            <Text variant="display-sm" tone="primary" weight="semibold">
              {formatPrice(variant.dealPriceCents)}
            </Text>
            <Text variant="body-md" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
              {formatPrice(variant.originalPriceCents)}
            </Text>
            {variant.unitCount && variant.unitLabel ? (
              <Text variant="body-sm" tone="tertiary">
                · {variant.unitCount} {variant.unitLabel}
              </Text>
            ) : null}
          </Stack>

          <Stack direction="row" gap={2} align="center">
            <Text variant="body-sm" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {deal.vendor.businessName}
              {deal.vendor.ratingAvg !== null ? `  ·  ★ ${deal.vendor.ratingAvg.toFixed(1)}` : ''}
              {distanceLabel ? `  ·  ${distanceLabel}` : ''}
            </Text>
          </Stack>

          {spotsLeft !== null && spotsLeft <= 10 ? (
            <Text variant="body-sm" tone="brand" weight="semibold">
              Only {spotsLeft} spots left
            </Text>
          ) : null}
        </Stack>
      </View>
    </Pressable>
  );
}

function formatDistanceLabel(miles: number | null): string | null {
  if (miles === null) return null;
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft away`;
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}
