import type { DealSummary } from '@gloe/api-client';
import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { usePrefetch } from '../prefetch/usePrefetch';
import { Icon } from '../icon/Icon';
import { formatPrice } from './format';
import { TrendingRibbon } from './TrendingRibbon';

interface FeaturedCarouselProps {
  deals: DealSummary[];
  onSave: (dealId: string) => void;
  savedIds: Set<string>;
}

/**
 * Horizontal swipeable carousel of sponsored/featured deals.
 */
export function FeaturedCarousel({ deals, onSave, savedIds }: FeaturedCarouselProps) {
  if (deals.length === 0) return null;

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = screenWidth * 0.78;

  return (
    <Stack gap={3}>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="display-sm" tone="primary" weight="medium">
          Featured
        </Text>
      </Stack>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + space[3]}
        contentContainerStyle={{
          paddingRight: space[5],
          gap: space[3],
        }}
      >
        {deals.map((deal) => (
          <FeaturedCard
            key={deal.id}
            deal={deal}
            width={cardWidth}
            isSaved={savedIds.has(deal.id)}
            onSave={() => onSave(deal.id)}
          />
        ))}
      </ScrollView>
    </Stack>
  );
}

interface FeaturedCardProps {
  deal: DealSummary;
  width: number;
  isSaved: boolean;
  onSave: () => void;
}

function FeaturedCard({ deal, width, isSaved, onSave }: FeaturedCardProps) {
  const router = useRouter();
  const { color: palette } = useTheme();
  const prefetch = usePrefetch();
  const variant = deal.headlineVariant;
  if (!variant) return null;

  const discountPct = Math.round(
    ((variant.originalPriceCents - variant.dealPriceCents) / variant.originalPriceCents) * 100,
  );

  return (
    <Pressable
      onPressIn={() => prefetch.deal(deal.id)}
      onPress={() => router.push(`/(app)/deal/${deal.id}`)}
      style={{
        width,
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.xl,
        overflow: 'hidden',
        ...shadow.md,
      }}
    >
      <View style={{ width: '100%', aspectRatio: 16 / 10, position: 'relative' }}>
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
            top: space[3],
            right: space[3],
            width: 36,
            height: 36,
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
        <View
          style={{
            position: 'absolute',
            top: space[3],
            left: space[3],
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
        {deal.isTrending ? <TrendingRibbon /> : null}
      </View>

      <View style={{ padding: space[4] }}>
        <Stack gap={2}>
          <Text variant="caption" tone="tertiary" weight="medium">
            {deal.category.displayName.toUpperCase()}
            {deal.category.subtypeDisplayName ? ` · ${deal.category.subtypeDisplayName}` : ''}
          </Text>
          <Text variant="body-lg" tone="primary" weight="semibold" numberOfLines={1}>
            {deal.title}
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: space[2],
              paddingVertical: 2,
              borderRadius: radius.sm,
              backgroundColor: palette.brand[100],
            }}
          >
            <Text variant="caption" weight="medium" style={{ color: palette.brand[700] }}>
              Sponsored
            </Text>
          </View>
          <Stack direction="row" gap={2} align="baseline">
            <Text variant="display-sm" tone="primary" weight="semibold">
              {formatPrice(variant.dealPriceCents)}
            </Text>
            <Text
              variant="body-sm"
              tone="tertiary"
              style={{ textDecorationLine: 'line-through' }}
            >
              {formatPrice(variant.originalPriceCents)}
            </Text>
          </Stack>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {deal.vendor.businessName}
            {deal.vendor.ratingAvg !== null ? ` · ★ ${deal.vendor.ratingAvg.toFixed(1)}` : ''}
          </Text>
        </Stack>
      </View>
    </Pressable>
  );
}
