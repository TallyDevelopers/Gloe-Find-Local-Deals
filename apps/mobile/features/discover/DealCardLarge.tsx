import type { DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Dimensions, Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { usePrefetch } from '../prefetch/usePrefetch';
import { Icon } from '../icon/Icon';
import { formatDistance, formatDriveTime, formatRating } from './cardMeta';
import { formatPrice } from './format';
import { TrendingRibbon } from './TrendingRibbon';

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
  const { color: palette } = useTheme();
  const prefetch = usePrefetch();
  const variant = deal.headlineVariant;
  if (!variant) return null;

  const discountPct = Math.round(
    ((variant.originalPriceCents - variant.dealPriceCents) / variant.originalPriceCents) * 100,
  );
  const spotsLeft = variant.spotsTotal !== null ? variant.spotsTotal - variant.spotsClaimed : null;
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
        ...shadow.sm,
      }}
    >
      <View style={{ width: '100%', height: IMG_HEIGHT, position: 'relative' }}>
        {deal.primaryPhotoUrl ? (
          <CachedImage uri={deal.primaryPhotoUrl} style={{ width: '100%', height: '100%' }} />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: palette.neutral[200] }} />
        )}

        <View
          style={{
            position: 'absolute',
            top: space[3],
            left: space[3],
            backgroundColor: palette.brand[500],
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
            backgroundColor: palette.surface.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            ...shadow.sm,
          }}
        >
          <Icon
            name="heart"
            size={18}
            color={isSaved ? palette.accent[500] : palette.text.primary}
            fill={isSaved ? palette.accent[500] : 'none'}
            strokeWidth={2.25}
          />
        </Pressable>

        {deal.isTrending ? (
          // Sit above the Sponsored badge when both are present, else at the edge.
          <TrendingRibbon bottom={deal.isSponsored ? space[3] + 28 : space[3]} />
        ) : null}

        {deal.isSponsored ? (
          <View
            style={{
              position: 'absolute',
              bottom: space[3],
              left: space[3],
              backgroundColor: palette.brand[100],
              paddingHorizontal: space[2],
              paddingVertical: 2,
              borderRadius: radius.sm,
            }}
          >
            <Text variant="caption" weight="medium" style={{ color: palette.brand[700] }}>
              Sponsored
            </Text>
          </View>
        ) : null}
      </View>

      {/* Body — same anatomy as the rail DealCard / web card (approved comp):
          rose-gold eyebrow, title, verified provider · city, display price,
          hairline-topped meta footer. */}
      <View style={{ padding: space[4] }}>
        <Stack gap={2}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.1,
              textTransform: 'uppercase',
              color: palette.brand[600],
            }}
          >
            {deal.category.subtypeDisplayName ?? deal.category.displayName}
          </Text>
          <Text variant="display-sm" tone="primary" weight="semibold" numberOfLines={2} style={{ letterSpacing: -0.2 }}>
            {deal.title}
          </Text>

          <Stack direction="row" gap={1} align="center">
            <Icon name="badgeCheck" size={15} color={palette.brand[500]} strokeWidth={2.25} />
            <Text variant="body-sm" tone="secondary" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
              {' '}{deal.vendor.businessName}
              {deal.vendor.city && !deal.vendor.businessName.toLowerCase().includes(deal.vendor.city.toLowerCase())
                ? ` · ${deal.vendor.city}`
                : ''}
            </Text>
          </Stack>

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

          {rating || driveTime || distance ? (
            <Stack
              direction="row"
              gap={1}
              align="center"
              style={{
                flexWrap: 'wrap',
                borderTopWidth: 1,
                borderTopColor: palette.border.subtle,
                paddingTop: space[2],
                marginTop: 2,
              }}
            >
              {rating ? (
                <>
                  <Icon name="star" size={12} color={palette.brand[500]} fill={palette.brand[500]} strokeWidth={0} />
                  <Text variant="body-sm" tone="secondary"> {rating.replace('★ ', '')}</Text>
                </>
              ) : null}
              {driveTime ? (
                <>
                  {rating ? <Text variant="body-sm" tone="secondary"> · </Text> : null}
                  <Icon name="clock" size={13} color={palette.text.secondary} strokeWidth={2} />
                  <Text variant="body-sm" tone="secondary"> {driveTime}</Text>
                </>
              ) : null}
              {distance ? (
                <Text variant="body-sm" tone="secondary">
                  {(rating || driveTime) ? ' · ' : ''}{distance}
                </Text>
              ) : null}
            </Stack>
          ) : null}

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

