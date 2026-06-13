import type { DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { usePrefetch } from '../prefetch/usePrefetch';
import { Icon } from '../icon/Icon';
import { formatDistance, formatDriveTime, formatRating } from './cardMeta';
import { formatPrice, promoBadgeLabel, promoPriceCents } from './format';
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
  // Deal promo (GLO-44): badge takes the top-left slot; the price row shows
  // the post-promo price so the card matches what checkout charges.
  const promo = deal.promo;
  const effectivePriceCents = promoPriceCents(variant.dealPriceCents, promo);

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
        {/* One top-left badge, not two callouts. A live promo (GLO-44) wins
            the slot; then Sponsored; then "% off" — the card never stacks
            badges. */}
        <View
          style={{
            position: 'absolute',
            top: space[2],
            left: space[2],
            backgroundColor: promo ? palette.brand[600] : palette.brand[500],
            paddingHorizontal: space[2],
            paddingVertical: 2,
            borderRadius: radius.pill,
          }}
        >
          <Text variant="caption" tone="inverse" weight="semibold">
            {promo ? promoBadgeLabel(promo) : deal.isSponsored ? 'Sponsored' : `${discountPct}% off`}
          </Text>
        </View>
        {deal.isTrending ? <TrendingRibbon bottom={8} /> : null}
      </View>

      {/* Body — mirrors the web card anatomy exactly (approved Discover comp):
          rose-gold uppercase eyebrow, 2-line title with reserved height so
          prices align across a rail, verified provider · city, display-font
          price row, then a hairline-topped meta footer. */}
      <View style={{ paddingHorizontal: space[3], paddingTop: space[3], paddingBottom: space[3] }}>
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
          <Text
            variant="body-md"
            tone="primary"
            weight="semibold"
            numberOfLines={2}
            style={{ fontSize: 15.5, lineHeight: 20, minHeight: 40, letterSpacing: -0.15 }}
          >
            {deal.title}
          </Text>

          <Stack direction="row" gap={1} align="center">
            <Icon name="badgeCheck" size={14} color={palette.brand[500]} strokeWidth={2.25} />
            <Text variant="caption" tone="secondary" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
              {' '}{deal.vendor.businessName}
              {deal.vendor.city && !deal.vendor.businessName.toLowerCase().includes(deal.vendor.city.toLowerCase())
                ? ` · ${deal.vendor.city}`
                : ''}
            </Text>
          </Stack>

          {/* Sponsored is shown by the top-left image badge now — no separate
              in-text pill. */}
          <Stack direction="row" gap={2} align="baseline">
            <Text variant="display-sm" tone="primary" weight="semibold" style={{ fontSize: 19, lineHeight: 24 }}>
              {formatPrice(effectivePriceCents)}
            </Text>
            <Text
              variant="body-sm"
              tone="tertiary"
              style={{ textDecorationLine: 'line-through' }}
            >
              {formatPrice(variant.originalPriceCents)}
            </Text>
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
                  <Icon name="star" size={11} color={palette.brand[500]} fill={palette.brand[500]} strokeWidth={0} />
                  <Text variant="caption" tone="secondary"> {rating.replace('★ ', '')}</Text>
                </>
              ) : null}
              {driveTime ? (
                <>
                  {rating ? <Text variant="caption" tone="secondary"> · </Text> : null}
                  <Icon name="clock" size={11} color={palette.text.secondary} strokeWidth={2} />
                  <Text variant="caption" tone="secondary"> {driveTime}</Text>
                </>
              ) : null}
              {distance ? (
                <Text variant="caption" tone="secondary">
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

