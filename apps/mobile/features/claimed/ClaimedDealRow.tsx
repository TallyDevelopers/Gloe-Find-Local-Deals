import { Stack, Text, color, radius, shadow, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Image, Pressable, View } from 'react-native';

import { trpc } from '@gloe/api-client';

import { formatPrice } from '../discover/format';
import type { ClaimedDeal } from './types';

interface ClaimedDealRowProps {
  claim: ClaimedDeal;
}

export function ClaimedDealRow({ claim }: ClaimedDealRowProps) {
  const router = useRouter();
  const dealQuery = trpc.deals.byId.useQuery({ id: claim.dealId }, { staleTime: 5 * 60_000 });
  const image = dealQuery.data?.photos[0]?.url;

  const now = Date.now();
  const isExpired = claim.status === 'expired' || claim.expiresAt < now;
  const isRedeemed = claim.status === 'redeemed';

  const statusLabel = isRedeemed
    ? 'Redeemed'
    : isExpired
      ? 'Expired'
      : `${formatRelative(claim.expiresAt - now)} left`;
  const statusTone: 'brand' | 'tertiary' | 'error' = isRedeemed
    ? 'tertiary'
    : isExpired
      ? 'error'
      : 'brand';

  return (
    <Pressable
      onPress={() => router.push(`/(app)/my-deal/${claim.id}`)}
      style={{
        backgroundColor: color.surface.elevated,
        borderRadius: radius.lg,
        padding: space[3],
        flexDirection: 'row',
        gap: space[3],
        alignItems: 'center',
        ...shadow.sm,
        opacity: isRedeemed || isExpired ? 0.6 : 1,
      }}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.md,
            backgroundColor: color.neutral[200],
          }}
        />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.md,
            backgroundColor: color.neutral[200],
          }}
        />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" tone="tertiary" weight="medium" numberOfLines={1}>
          {claim.snapshot.vendorName}
        </Text>
        <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
          {claim.snapshot.dealTitle}
        </Text>
        <Stack direction="row" gap={2} align="baseline">
          <Text variant="body-sm" tone="primary" weight="semibold">
            {formatPrice(claim.snapshot.dealPriceCents)}
          </Text>
          <Text variant="caption" tone="tertiary">
            · {claim.snapshot.variantLabel}
          </Text>
        </Stack>
      </View>
      <Stack gap={1} align="flex-end">
        <Text variant="caption" tone={statusTone} weight="semibold">
          {statusLabel.toUpperCase()}
        </Text>
        <Text variant="body-md" tone="tertiary">
          ›
        </Text>
      </Stack>
    </Pressable>
  );
}

function formatRelative(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
