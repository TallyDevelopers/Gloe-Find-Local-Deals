import { Button, Stack, Text, color, radius, shadow, space } from '@gloe/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { formatPrice } from '../../../features/discover/format';

export default function MyDealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getById, markRedeemed } = useClaimedDeals();
  const [, forceTick] = useState(0);

  const claim = id ? getById(id) : undefined;

  // Re-render every minute so the countdown updates
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!claim) {
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
          <Text variant="display-sm" tone="primary">Deal not found</Text>
          <Pressable onPress={() => router.back()} style={{ paddingVertical: space[3] }}>
            <Text variant="body-md" tone="link" weight="semibold">Go back</Text>
          </Pressable>
        </Stack>
      </View>
    );
  }

  const { snapshot } = claim;
  const isRedeemed = claim.status === 'redeemed';
  const expiresInMs = claim.expiresAt - Date.now();
  const isExpired = expiresInMs <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[3],
          paddingBottom: insets.bottom + space[8],
          paddingHorizontal: space[5],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={6}>
          {/* Close */}
          <Stack direction="row" justify="space-between" align="center">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text variant="body-md" tone="secondary" weight="medium">
                ← Done
              </Text>
            </Pressable>
            <Text variant="caption" tone="tertiary" weight="medium">
              {isRedeemed ? 'REDEEMED' : isExpired ? 'EXPIRED' : 'YOUR DEAL'}
            </Text>
          </Stack>

          {/* Header */}
          <Stack gap={2} align="center">
            <Text variant="display-md" tone="primary" weight="medium" align="center">
              {snapshot.vendorName}
            </Text>
            <Text variant="body-md" tone="secondary" align="center">
              {snapshot.dealTitle}
            </Text>
            <Text variant="body-sm" tone="tertiary">
              {snapshot.variantLabel}
            </Text>
          </Stack>

          {/* QR code card */}
          <View
            style={{
              backgroundColor: color.surface.elevated,
              borderRadius: radius['2xl'],
              padding: space[8],
              alignItems: 'center',
              ...shadow.md,
              opacity: isRedeemed || isExpired ? 0.4 : 1,
            }}
          >
            <QRCode
              value={claim.qrPayload}
              size={240}
              color={color.text.primary}
              backgroundColor={color.surface.elevated}
              quietZone={8}
            />
            <View style={{ marginTop: space[5] }}>
              <Text variant="caption" tone="tertiary" weight="medium" align="center">
                CODE
              </Text>
              <Text
                variant="body-md"
                tone="primary"
                weight="semibold"
                align="center"
                style={{ letterSpacing: 2, marginTop: 2 }}
              >
                {claim.id.split('_')[1]?.slice(0, 8).toUpperCase() ?? '—'}
              </Text>
            </View>
          </View>

          {/* Status / instructions */}
          {isRedeemed ? (
            <Stack gap={2} align="center">
              <Text variant="body-md" tone="brand" weight="semibold" align="center">
                ✓ Redeemed
              </Text>
              <Text variant="body-sm" tone="secondary" align="center">
                {claim.redeemedAt
                  ? `Used at ${snapshot.vendorName} on ${formatDateTime(claim.redeemedAt)}.`
                  : `Used at ${snapshot.vendorName}.`}
              </Text>
            </Stack>
          ) : isExpired ? (
            <Stack gap={2} align="center">
              <Text variant="body-md" tone="error" weight="semibold" align="center">
                Deal expired
              </Text>
              <Text variant="body-sm" tone="secondary" align="center">
                This deal expired on {formatDateTime(claim.expiresAt)}.
              </Text>
            </Stack>
          ) : (
            <Stack gap={3} align="center">
              <Text variant="body-md" tone="primary" weight="medium" align="center">
                Show this code to your provider
              </Text>
              <Text variant="body-sm" tone="secondary" align="center">
                Expires in {formatRelative(expiresInMs)}
              </Text>
            </Stack>
          )}

          {/* Price block */}
          <View
            style={{
              backgroundColor: color.surface.elevated,
              borderRadius: radius.lg,
              padding: space[5],
            }}
          >
            <Stack direction="row" justify="space-between" align="baseline">
              <Text variant="body-md" tone="secondary">You pay</Text>
              <Stack direction="row" gap={2} align="baseline">
                <Text variant="display-sm" tone="primary" weight="semibold">
                  {formatPrice(snapshot.dealPriceCents)}
                </Text>
                <Text
                  variant="body-sm"
                  tone="tertiary"
                  style={{ textDecorationLine: 'line-through' }}
                >
                  {formatPrice(snapshot.originalPriceCents)}
                </Text>
              </Stack>
            </Stack>
          </View>

          {/* Dev-only: mark redeemed manually (until vendor app exists) */}
          {!isRedeemed && !isExpired ? (
            <Button
              label="Simulate redemption"
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => markRedeemed(claim.id)}
            />
          ) : null}

          <Text variant="caption" tone="tertiary" align="center">
            Code is unique to your account. Do not share.
          </Text>
        </Stack>
      </ScrollView>
    </View>
  );
}

function formatRelative(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
