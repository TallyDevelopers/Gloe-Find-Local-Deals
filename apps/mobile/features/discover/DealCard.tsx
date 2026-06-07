import type { DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { usePrefetch } from '../prefetch/usePrefetch';
import { Icon } from '../icon/Icon';
import { formatDistance, formatDriveTime, formatRating } from './cardMeta';
import { formatPrice } from './format';
import { TrendingRibbon } from './TrendingRibbon';

interface DealCardProps {
  deal: DealSummary;
  onSave: () => void;
  isSaved?: boolean;
  /** Fixed width for horizontal rails; omit to fill its column in the grid. */
  width?: number;
  /**
   * Image aspect ratio (width / height). Default 1 (square) for the 2-up grid;
   * rails pass a wider ratio (e.g. 4/3) so the card isn't so tall — a browse
   * rail wants to show more at a glance, not a billboard per item.
   */
  imageAspectRatio?: number;
}

/**
 * Compact image-dominant card. Fills its column in the 2-up grid, or takes a
 * fixed width inside a horizontal category rail. Tap → deal detail; heart → save.
 */
export function DealCard({ deal, onSave, isSaved = false, width, imageAspectRatio = 1 }: DealCardProps) {
  const router = useRouter();
  const { color: palette } = useTheme();
  const prefetch = usePrefetch();
  const variant = deal.headlineVariant;
  if (!variant) return null;

  const discountPct = Math.round(
    ((variant.originalPriceCents - variant.dealPriceCents) / variant.originalPriceCents) * 100,
  );

  const spotsLeft =
    variant.spotsTotal !== null ? variant.spotsTotal - variant.spotsClaimed : null;

  const rating = formatRating(deal.vendor);
  const driveTime = formatDriveTime(deal.driveSeconds);
  const distance = formatDistance(deal.distanceMiles);

  return (
    <Pressable
      onPressIn={() => prefetch.deal(deal.id)}
      onPress={() => router.push(`/(app)/deal/${deal.id}`)}
      style={{
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...(width ? { width } : {}),
        ...shadow.sm,
      }}
    >
      <View style={{ width: '100%', aspectRatio: imageAspectRatio, position: 'relative' }}>
        {deal.primaryPhotoUrl ? (
          <CachedImage
            uri={deal.primaryPhotoUrl}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View
            style={{ width: '100%', height: '100%', backgroundColor: palette.neutral[200] }}
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
            backgroundColor: palette.surface.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.sm,
          }}
        >
          <Icon
            name="heart"
            size={16}
            color={isSaved ? palette.accent[500] : palette.text.primary}
            fill={isSaved ? palette.accent[500] : 'none'}
            strokeWidth={2.25}
          />
        </Pressable>
        <View
          style={{
            position: 'absolute',
            top: space[2],
            left: space[2],
            backgroundColor: palette.brand[500],
            paddingHorizontal: space[2],
            paddingVertical: 2,
            borderRadius: radius.pill,
          }}
        >
          <Text variant="caption" tone="inverse" weight="semibold">
            {discountPct}% off
          </Text>
        </View>
        {deal.isTrending ? <TrendingRibbon bottom={8} /> : null}
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
                backgroundColor: palette.brand[100],
                marginTop: 2,
                marginBottom: 2,
              }}
            >
              <Text variant="caption" weight="medium" style={{ color: palette.brand[700] }}>
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
          <Text variant="caption" tone="secondary" numberOfLines={1} weight="medium">
            {deal.vendor.businessName}
          </Text>
          {rating || driveTime || distance ? (
            <Stack direction="row" gap={1} align="center" style={{ flexWrap: 'wrap' }}>
              {rating ? <Text variant="caption" tone="tertiary">{rating}</Text> : null}
              {driveTime ? (
                <>
                  {rating ? <Text variant="caption" tone="tertiary"> · </Text> : null}
                  <Icon name="clock" size={11} color={palette.text.tertiary} strokeWidth={2} />
                  <Text variant="caption" tone="tertiary"> {driveTime}</Text>
                </>
              ) : null}
              {distance ? (
                <Text variant="caption" tone="tertiary">
                  {(rating || driveTime) ? ' · ' : ''}{distance}
                </Text>
              ) : null}
            </Stack>
          ) : null}
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

