import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPrice } from '../discover/format';
import { useClaimedDeals } from './ClaimedDealsProvider';

/**
 * Minimal subset of a deal that this sheet needs. Decoupled from the API
 * shape so any caller (current or future) can use it.
 */
export interface ClaimConfirmDeal {
  id: string;
  title: string;
  categoryLabel: string;       // e.g. "Botox" or "Botox · Dysport"
  vendorName: string;
  vendorContextLine: string;   // e.g. "1.2 mi" or "San Diego"
}

export interface ClaimConfirmVariant {
  id: string;
  label: string;
  originalPriceCents: number;
  dealPriceCents: number;
}

interface ClaimConfirmSheetProps {
  deal: ClaimConfirmDeal | null;
  variant: ClaimConfirmVariant | null;
  monthlyUsed: number;
  monthlyLimit: number;
  onClose: () => void;
}

export function ClaimConfirmSheet({
  deal,
  variant,
  monthlyUsed,
  monthlyLimit,
  onClose,
}: ClaimConfirmSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { color: palette } = useTheme();
  const { createClaim } = useClaimedDeals();
  const translateY = useRef(new Animated.Value(800)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const isOpen = deal !== null && variant !== null;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 280,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, translateY, overlayOpacity]);

  const close = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 800,
        useNativeDriver: true,
        damping: 28,
        stiffness: 280,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleConfirm = async () => {
    if (!deal || !variant) return;
    try {
      const claim = await createClaim({ dealId: deal.id, variantId: variant.id });
      Animated.parallel([
        Animated.spring(translateY, { toValue: 800, useNativeDriver: true, damping: 28, stiffness: 280 }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        onClose();
        router.push(`/(app)/my-deal/${claim.id}`);
      });
    } catch (e) {
      // TODO: surface a toast / error state. For now, log and close.
      console.warn('Claim failed', e);
      close();
    }
  };

  if (!deal || !variant) return null;

  const remaining = Math.max(0, monthlyLimit - monthlyUsed);
  const willExhaust = remaining === 1;
  const cannotClaim = remaining === 0;

  return (
    <Modal transparent animationType="none" visible={isOpen} onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.surface.overlay,
            opacity: overlayOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: palette.surface.primary,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingTop: space[4],
            paddingHorizontal: space[6],
            paddingBottom: insets.bottom + space[6],
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: palette.neutral[300],
              marginBottom: space[6],
            }}
          />

          <Stack gap={6}>
            <Stack gap={2}>
              <Text variant="display-sm" tone="primary" weight="medium">
                Claim this deal?
              </Text>
              <Text variant="body-md" tone="secondary">
                You'll get a QR coupon valid for 7 days. Show it at your appointment to redeem.
              </Text>
            </Stack>

            <View
              style={{
                backgroundColor: palette.surface.elevated,
                borderRadius: radius.lg,
                padding: space[4],
                gap: space[3],
              }}
            >
              <Stack gap={1}>
                <Text variant="caption" tone="tertiary" weight="medium">
                  {deal.categoryLabel.toUpperCase()} · {variant.label}
                </Text>
                <Text variant="body-lg" tone="primary" weight="semibold" numberOfLines={2}>
                  {deal.title}
                </Text>
                <Text variant="body-sm" tone="secondary">
                  {deal.vendorName} · {deal.vendorContextLine}
                </Text>
              </Stack>
              <View
                style={{
                  height: 1,
                  backgroundColor: palette.border.subtle,
                }}
              />
              <Stack direction="row" justify="space-between" align="baseline">
                <Text variant="body-md" tone="secondary">
                  You pay
                </Text>
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
              </Stack>
            </View>

            <Stack gap={1}>
              <Text variant="body-sm" tone={cannotClaim ? 'error' : willExhaust ? 'brand' : 'secondary'} weight="medium">
                {cannotClaim
                  ? 'You\'ve used all your monthly redemptions.'
                  : willExhaust
                    ? `This is your last redemption this month (${monthlyUsed}/${monthlyLimit} used).`
                    : `Uses 1 of your ${remaining} remaining monthly redemptions.`}
              </Text>
            </Stack>

            <Stack gap={3}>
              <Button
                label="Claim now"
                size="lg"
                fullWidth
                onPress={handleConfirm}
                disabled={cannotClaim}
              />
              <Button label="Not now" variant="ghost" size="md" fullWidth onPress={close} />
            </Stack>
          </Stack>
        </Animated.View>
      </View>
    </Modal>
  );
}
