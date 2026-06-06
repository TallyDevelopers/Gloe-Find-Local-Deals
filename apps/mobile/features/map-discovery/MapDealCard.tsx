import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { usePrefetch } from '../prefetch/usePrefetch';
import { Icon } from '../icon/Icon';
import { formatDistance, formatRating } from '../discover/cardMeta';
import { formatPrice } from '../discover/format';
import type { SpaPin } from './spaGrouping';

interface MapDealCardProps {
  spa: SpaPin;
  /** Card width — set by the carousel so it snaps cleanly. */
  width: number;
  isSaved?: boolean;
  onSave?: () => void;
}

/**
 * Horizontal spa card pinned above the map, ResortPass-style. Shows the spa's
 * headline deal; if the spa has more deals, a "+N more experiences" line hints
 * at depth without cluttering the map. Tapping the card opens the headline
 * deal (a spa with multiple deals routes to the vendor storefront instead).
 */
export function MapDealCard({ spa, width, isSaved = false, onSave }: MapDealCardProps) {
  const router = useRouter();
  const { color: palette } = useTheme();
  const prefetch = usePrefetch();

  const deal = spa.headline;
  const variant = deal.headlineVariant;
  const extra = spa.deals.length - 1;
  const rating = formatRating(deal.vendor);
  const distance = formatDistance(deal.distanceMiles);

  const open = () => {
    if (extra > 0) router.push(`/(app)/vendor/${spa.vendorId}`);
    else router.push(`/(app)/deal/${deal.id}`);
  };

  return (
    <Pressable
      onPressIn={() => prefetch.deal(deal.id)}
      onPress={open}
      style={{
        width,
        flexDirection: 'row',
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        overflow: 'hidden',
        ...shadow.md,
      }}
    >
      <View style={{ width: 116, height: 116, backgroundColor: palette.neutral[200] }}>
        {deal.primaryPhotoUrl ? (
          <CachedImage uri={deal.primaryPhotoUrl} style={{ width: '100%', height: '100%' }} />
        ) : null}
      </View>

      <View style={{ flex: 1, padding: space[3], justifyContent: 'center' }}>
        <Stack gap={1}>
          <Text variant="body-sm" tone="primary" weight="semibold" numberOfLines={1}>
            {spa.businessName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {deal.title}
          </Text>

          <Stack direction="row" gap={1} align="baseline" style={{ marginTop: 2 }}>
            {variant ? (
              <>
                <Text variant="body-md" tone="primary" weight="semibold">
                  {formatPrice(variant.dealPriceCents)}
                </Text>
                <Text variant="caption" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
                  {formatPrice(variant.originalPriceCents)}
                </Text>
              </>
            ) : null}
          </Stack>

          {rating || distance ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {[rating, distance].filter(Boolean).join('  ·  ')}
            </Text>
          ) : null}

          {extra > 0 ? (
            <Text variant="caption" tone="brand" weight="semibold">
              +{extra} more {extra === 1 ? 'experience' : 'experiences'}
            </Text>
          ) : null}
        </Stack>
      </View>

      {onSave ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onSave();
          }}
          hitSlop={8}
          style={{ position: 'absolute', top: space[2], right: space[2], padding: 4 }}
        >
          <Icon
            name="heart"
            size={18}
            color={isSaved ? palette.accent[500] : palette.text.tertiary}
            fill={isSaved ? palette.accent[500] : 'none'}
            strokeWidth={2.25}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
