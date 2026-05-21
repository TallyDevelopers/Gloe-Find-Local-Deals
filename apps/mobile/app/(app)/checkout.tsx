import { trpc } from '@gloe/api-client';
import { Button, Stack, Text, color, radius, space } from '@gloe/ui';
import { useStripe } from '@stripe/stripe-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPrice } from '../../features/discover/format';

/**
 * Checkout — a routed screen showing the deal summary + quantity, then Stripe's
 * prebuilt PaymentSheet on Pay. The sheet surfaces every method enabled in the
 * Stripe dashboard (card, Apple Pay, Link, Klarna, Cash App, US bank). Voucher(s)
 * are created server-side on the payment_intent.succeeded webhook; on success we
 * route to the wallet.
 */
export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    dealId: string;
    title: string;
    categoryLabel: string;
    vendorName: string;
    vendorRating: string;
    vendorReviews: string;
    photoUrl: string;
    variantId: string;
    variantLabel: string;
    originalPriceCents: string;
    dealPriceCents: string;
    discountPct: string;
    spotsLeft: string;
    expiresAt: string;
    perCustomerLimit: string;
  }>();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const createPurchase = trpc.checkout.createPurchase.useMutation();
  const utils = trpc.useUtils();

  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalPriceCents = Number(params.originalPriceCents);
  const dealPriceCents = Number(params.dealPriceCents);
  const discountPct = Number(params.discountPct) || 0;
  const spotsLeft = params.spotsLeft === '' ? null : Number(params.spotsLeft);
  const perCustomerLimit = Number(params.perCustomerLimit) || 10;
  const rating = params.vendorRating === '' ? null : Number(params.vendorRating);

  const maxQty = Math.min(perCustomerLimit, spotsLeft != null ? spotsLeft : 10);
  const totalCents = dealPriceCents * qty;
  const savedCents = (originalPriceCents - dealPriceCents) * qty;

  const handleBuy = async () => {
    setError(null);
    setBusy(true);
    try {
      // 1. Server creates the PaymentIntent + pending transaction.
      const res = await createPurchase.mutateAsync({ variantId: params.variantId, quantity: qty });
      // 2. Init Stripe's PaymentSheet (all dashboard-enabled methods).
      const init = await initPaymentSheet({
        merchantDisplayName: 'Gloē',
        paymentIntentClientSecret: res.clientSecret,
        allowsDelayedPaymentMethods: true, // Klarna / Cash App / US bank
        returnURL: 'gloe://stripe-redirect',
        applePay: { merchantCountryCode: 'US' },
        // Gloē-branded sheet: warm ivory surfaces, champagne accent.
        appearance: {
          colors: {
            primary: color.brand[500],
            background: color.surface.elevated,
            componentBackground: color.surface.secondary,
            componentBorder: color.brand[200],
            componentDivider: color.brand[100],
            primaryText: color.text.primary,
            secondaryText: color.text.secondary,
            componentText: color.text.primary,
            placeholderText: color.text.tertiary,
            icon: color.text.secondary,
            error: color.semantic.error,
          },
          shapes: { borderRadius: radius.lg, borderWidth: 1 },
          primaryButton: {
            colors: {
              background: color.brand[500],
              text: color.text.inverse,
              border: color.brand[500],
            },
            shapes: { borderRadius: radius.lg },
          },
        },
      });
      if (init.error) {
        setError(init.error.message);
        return;
      }
      // 3. Present the sheet.
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') setError(payError.message);
        return;
      }
      // 4. Paid. Webhook creates the voucher(s); refresh wallet + route there.
      void utils.invalidate();
      router.replace('/(app)/(tabs)/saved');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
      {/* Header with back button */}
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingHorizontal: space[5],
          paddingBottom: space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          borderBottomWidth: 1,
          borderBottomColor: color.border.subtle,
          backgroundColor: color.surface.elevated,
        }}
      >
        <Pressable
          onPress={busy ? undefined : () => router.back()}
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.surface.secondary,
            opacity: busy ? 0.4 : 1,
          }}
        >
          <Text variant="body-lg" tone="primary" weight="semibold">‹</Text>
        </Pressable>
        <Text variant="display-sm" tone="primary" weight="medium">Checkout</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space[6], paddingBottom: insets.bottom + space[6] }}
      >
        <Stack gap={5}>
          {/* Item card — photo + what they're getting */}
          <View style={{ backgroundColor: color.surface.elevated, borderRadius: radius.lg, padding: space[4], gap: space[4] }}>
            <Stack direction="row" gap={4}>
              {params.photoUrl ? (
                <Image
                  source={{ uri: params.photoUrl }}
                  style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: color.surface.secondary }}
                />
              ) : null}
              <Stack gap={1} style={{ flex: 1 }}>
                <Text variant="caption" tone="tertiary" weight="medium">
                  {params.categoryLabel.toUpperCase()} · {params.variantLabel}
                </Text>
                <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={2}>{params.title}</Text>
                <Stack direction="row" gap={2} align="center">
                  <Text variant="body-sm" tone="secondary">{params.vendorName}</Text>
                  {rating != null ? (
                    <Text variant="body-sm" tone="tertiary">★ {rating.toFixed(1)} ({params.vendorReviews})</Text>
                  ) : null}
                </Stack>
              </Stack>
            </Stack>

            {/* Quantity stepper — only when more than one is allowed. */}
            {maxQty > 1 ? (
              <>
                <View style={{ height: 1, backgroundColor: color.border.subtle }} />
                <Stack direction="row" justify="space-between" align="center">
                  <Text variant="body-md" tone="secondary">Quantity</Text>
                  <Stack direction="row" gap={4} align="center">
                    <StepBtn label="−" disabled={qty <= 1} onPress={() => setQty((q) => Math.max(1, q - 1))} />
                    <Text variant="body-lg" tone="primary" weight="semibold">{qty}</Text>
                    <StepBtn label="+" disabled={qty >= maxQty} onPress={() => setQty((q) => Math.min(maxQty, q + 1))} />
                  </Stack>
                </Stack>
              </>
            ) : (
              <>
                <View style={{ height: 1, backgroundColor: color.border.subtle }} />
                <Text variant="body-sm" tone="tertiary">Limit 1 per customer</Text>
              </>
            )}
          </View>

          {/* Price breakdown — they see the deal */}
          <View style={{ backgroundColor: color.surface.elevated, borderRadius: radius.lg, padding: space[4], gap: space[3] }}>
            <Stack direction="row" justify="space-between" align="center">
              <Text variant="body-md" tone="secondary">Original</Text>
              <Text variant="body-md" tone="tertiary" style={{ textDecorationLine: 'line-through' }}>
                {formatPrice(originalPriceCents * qty)}
              </Text>
            </Stack>
            {savedCents > 0 ? (
              <Stack direction="row" justify="space-between" align="center">
                <Stack direction="row" gap={2} align="center">
                  <Text variant="body-md" tone="secondary">You save</Text>
                  {discountPct > 0 ? (
                    <View style={{ backgroundColor: color.brand[500], borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 }}>
                      <Text variant="caption" weight="semibold" style={{ color: color.text.inverse }}>{discountPct}% off</Text>
                    </View>
                  ) : null}
                </Stack>
                <Text variant="body-md" weight="semibold" style={{ color: color.semantic.success }}>
                  −{formatPrice(savedCents)}
                </Text>
              </Stack>
            ) : null}
            <View style={{ height: 1, backgroundColor: color.border.subtle }} />
            <Stack direction="row" justify="space-between" align="baseline">
              <Text variant="body-lg" tone="primary" weight="semibold">Total</Text>
              <Text variant="display-sm" tone="primary" weight="semibold">{formatPrice(totalCents)}</Text>
            </Stack>
          </View>

          {/* Reassurance — urgency + guarantee */}
          <Stack gap={2}>
            {spotsLeft != null ? (
              <Stack direction="row" gap={2} align="center">
                <Text variant="body-sm" weight="semibold" style={{ color: color.brand[600] }}>
                  {spotsLeft} spots left
                </Text>
                {params.expiresAt ? (
                  <Text variant="body-sm" tone="tertiary">· Expires {formatExpiry(params.expiresAt)}</Text>
                ) : null}
              </Stack>
            ) : null}
            <Text variant="body-sm" tone="secondary">
              ✓ 3-day hassle-free refund · QR voucher delivered instantly
            </Text>
          </Stack>

          {error ? <Text variant="body-sm" tone="error">{error}</Text> : null}
        </Stack>
      </ScrollView>

      {/* Sticky pay bar */}
      <View
        style={{
          paddingHorizontal: space[5],
          paddingTop: space[4],
          paddingBottom: insets.bottom + space[3],
          borderTopWidth: 1,
          borderTopColor: color.border.subtle,
          backgroundColor: color.surface.elevated,
        }}
      >
        <Button
          label={busy ? 'Processing…' : `Pay ${formatPrice(totalCents)}`}
          size="lg"
          fullWidth
          onPress={handleBuy}
          disabled={busy}
          loading={busy}
        />
      </View>
    </View>
  );
}

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'soon';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

function StepBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      style={{
        width: 34, height: 34, borderRadius: radius.pill,
        borderWidth: 1, borderColor: disabled ? color.border.subtle : color.border.default,
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text variant="body-lg" tone="primary" weight="semibold">{label}</Text>
    </Pressable>
  );
}
