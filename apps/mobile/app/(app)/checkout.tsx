import { trpc } from '@gloe/api-client';
import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPrice } from '../../features/discover/format';
import { CachedImage } from '../../features/image/CachedImage';

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
    promoAmountCents: string;
    promoLabel: string;
    discountPct: string;
    spotsLeft: string;
    expiresAt: string;
    perCustomerLimit: string;
  }>();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const createPurchase = trpc.checkout.createPurchase.useMutation();
  const createGiftLink = trpc.checkout.createGiftLink.useMutation();
  const utils = trpc.useUtils();
  const { color: palette } = useTheme();

  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyCredits, setApplyCredits] = useState(true);

  const creditsQuery = trpc.credits.balance.useQuery();

  const originalPriceCents = Number(params.originalPriceCents);
  const dealPriceCents = Number(params.dealPriceCents);
  const discountPct = Number(params.discountPct) || 0;
  const spotsLeft = params.spotsLeft === '' ? null : Number(params.spotsLeft);
  const perCustomerLimit = Number(params.perCustomerLimit) || 10;
  const rating = params.vendorRating === '' ? null : Number(params.vendorRating);

  const maxQty = Math.min(perCustomerLimit, spotsLeft != null ? spotsLeft : 10);
  const totalCents = dealPriceCents * qty;
  const savedCents = (originalPriceCents - dealPriceCents) * qty;

  // Deal promo (GLO-44): cuts the price first, once per order (mirrors the
  // server's clamp — the post-promo total never drops below Stripe's 50¢
  // floor); credits then apply to the remainder.
  const promoAmountCents = Number(params.promoAmountCents) || 0;
  const promoCents = promoAmountCents > 0
    ? Math.max(0, Math.min(promoAmountCents, totalCents - 50))
    : 0;
  const chargeBaseCents = totalCents - promoCents;

  // Display estimate only — the server recomputes inside the purchase
  // transaction and its number is what Stripe charges. Locked referee credit
  // counts when this order clears its first-purchase floor (pre-credit).
  const balance = creditsQuery.data;
  const usableCreditCents = balance
    ? balance.availableCents +
      (balance.lockedCents > 0 && chargeBaseCents >= balance.lockedFloorCents ? balance.lockedCents : 0)
    : 0;
  let creditEstimateCents = applyCredits ? Math.min(usableCreditCents, chargeBaseCents) : 0;
  const remainder = chargeBaseCents - creditEstimateCents;
  if (remainder > 0 && remainder < 50) creditEstimateCents = chargeBaseCents - 50; // Stripe 50¢ charge floor
  const cashDueCents = chargeBaseCents - creditEstimateCents;

  const handleBuy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setBusy(true);
    try {
      // 1. Server creates the PaymentIntent + pending transaction. The server
      //    computes the credit amount itself — we only send the toggle.
      const res = await createPurchase.mutateAsync({
        variantId: params.variantId,
        quantity: qty,
        applyCredits,
      });
      // 1b. Credits covered the whole order — vouchers are already minted
      //     server-side, there is no Stripe step. Straight to success.
      if (res.paidWithCredits || !res.clientSecret) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void utils.invalidate();
        router.replace('/(app)/(tabs)/saved');
        return;
      }
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
            primary: palette.brand[500],
            background: palette.surface.elevated,
            componentBackground: palette.surface.secondary,
            componentBorder: palette.brand[200],
            componentDivider: palette.brand[100],
            primaryText: palette.text.primary,
            secondaryText: palette.text.secondary,
            componentText: palette.text.primary,
            placeholderText: palette.text.tertiary,
            icon: palette.text.secondary,
            error: palette.semantic.error,
          },
          shapes: { borderRadius: radius.lg, borderWidth: 1 },
          primaryButton: {
            colors: {
              background: palette.brand[500],
              text: palette.text.inverse,
              border: palette.brand[500],
            },
            shapes: { borderRadius: radius.lg },
          },
        },
      });
      if (init.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(init.error.message);
        return;
      }
      // 3. Present the sheet.
      const { error: payError } = await presentPaymentSheet();
      if (payError) {
        if (payError.code !== 'Canceled') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(payError.message);
        }
        return;
      }
      // 4. Paid. Webhook creates the voucher(s); refresh wallet + route there.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void utils.invalidate();
      router.replace('/(app)/(tabs)/saved');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * "Share to pay" — generate a Stripe Checkout Session URL and hand it to
   * iOS's native share sheet. Voucher credits to *this* (signed-in) user when
   * the recipient pays — same fulfillment path as in-app, different webhook.
   */
  const handleShareToPay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setSharing(true);
    try {
      const res = await createGiftLink.mutateAsync({ variantId: params.variantId, quantity: qty });
      // iOS renders the URL itself as a rich preview card (via the page's
      // OG tags) — passing `url` alone gives us the preview without a raw
      // URL in the message body. We add a short prefix as the message so
      // recipients see one preview card with a brief note above it.
      await Share.share({
        message: "Picked something out — here's the link ✨",
        url: res.giftUrl,
      });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError((e as Error).message);
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
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
          borderBottomColor: palette.border.subtle,
          backgroundColor: palette.surface.elevated,
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
            backgroundColor: palette.surface.secondary,
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
          <View style={{ backgroundColor: palette.surface.elevated, borderRadius: radius.lg, padding: space[4], gap: space[4] }}>
            <Stack direction="row" gap={4}>
              {params.photoUrl ? (
                <CachedImage
                  uri={params.photoUrl}
                  style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: palette.surface.secondary }}
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
                <View style={{ height: 1, backgroundColor: palette.border.subtle }} />
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
                <View style={{ height: 1, backgroundColor: palette.border.subtle }} />
                <Text variant="body-sm" tone="tertiary">Limit 1 per customer</Text>
              </>
            )}
          </View>

          {/* Price breakdown — they see the deal */}
          <View style={{ backgroundColor: palette.surface.elevated, borderRadius: radius.lg, padding: space[4], gap: space[3] }}>
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
                    <View style={{ backgroundColor: palette.brand[500], borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 }}>
                      <Text variant="caption" weight="semibold" style={{ color: palette.text.inverse }}>{discountPct}% off</Text>
                    </View>
                  ) : null}
                </Stack>
                <Text variant="body-md" weight="semibold" style={{ color: palette.semantic.success }}>
                  −{formatPrice(savedCents)}
                </Text>
              </Stack>
            ) : null}
            {promoCents > 0 ? (
              <Stack direction="row" justify="space-between" align="center">
                <Stack direction="row" gap={2} align="center">
                  <Text variant="body-md" tone="secondary">Promo</Text>
                  <View style={{ backgroundColor: palette.brand[600], borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 }}>
                    <Text variant="caption" weight="semibold" style={{ color: palette.text.inverse }}>
                      {params.promoLabel || 'Extra off'}
                    </Text>
                  </View>
                </Stack>
                <Text variant="body-md" weight="semibold" style={{ color: palette.brand[700] }}>
                  −{formatPrice(promoCents)}
                </Text>
              </Stack>
            ) : null}
            {usableCreditCents > 0 ? (
              <Stack direction="row" justify="space-between" align="center">
                <Stack direction="row" gap={2} align="center">
                  <Text variant="body-md" tone="secondary">Gloē credits</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setApplyCredits((v) => !v);
                    }}
                    hitSlop={8}
                    style={{
                      backgroundColor: applyCredits ? palette.brand[100] : palette.surface.secondary,
                      borderWidth: 1,
                      borderColor: applyCredits ? palette.brand[300] : palette.border.subtle,
                      borderRadius: radius.pill,
                      paddingHorizontal: space[2],
                      paddingVertical: 2,
                    }}
                  >
                    <Text variant="caption" weight="semibold" tone={applyCredits ? 'primary' : 'tertiary'}>
                      {applyCredits ? 'Applied' : 'Off'}
                    </Text>
                  </Pressable>
                </Stack>
                <Text
                  variant="body-md"
                  weight="semibold"
                  style={{ color: applyCredits ? palette.brand[700] : palette.text.tertiary }}
                >
                  {applyCredits ? `−${formatPrice(creditEstimateCents)}` : formatPrice(0)}
                </Text>
              </Stack>
            ) : null}
            <View style={{ height: 1, backgroundColor: palette.border.subtle }} />
            <Stack direction="row" justify="space-between" align="baseline">
              <Text variant="body-lg" tone="primary" weight="semibold">Total</Text>
              <Text variant="display-sm" tone="primary" weight="semibold">{formatPrice(cashDueCents)}</Text>
            </Stack>
          </View>

          {/* Reassurance — urgency + guarantee */}
          <Stack gap={2}>
            {spotsLeft != null ? (
              <Stack direction="row" gap={2} align="center">
                <Text variant="body-sm" weight="semibold" style={{ color: palette.brand[600] }}>
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
          borderTopColor: palette.border.subtle,
          backgroundColor: palette.surface.elevated,
          gap: space[3],
        }}
      >
        <Button
          label={busy ? 'Processing…' : cashDueCents === 0 ? 'Redeem with credits' : `Pay ${formatPrice(cashDueCents)}`}
          size="lg"
          fullWidth
          onPress={handleBuy}
          disabled={busy || sharing}
          loading={busy}
        />
        {/* Secondary action: hand off payment to someone else. Quiet by design
            — the hero action stays Pay; this is discoverable, not competing. */}
        <Pressable
          onPress={busy || sharing ? undefined : handleShareToPay}
          hitSlop={8}
          style={{ alignSelf: 'center', paddingVertical: space[2], opacity: busy || sharing ? 0.4 : 1 }}
        >
          <Text variant="body-sm" weight="medium" style={{ color: palette.brand[600] }}>
            {sharing ? 'Generating link…' : 'Share to pay'}
          </Text>
        </Pressable>
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
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      style={{
        width: 34, height: 34, borderRadius: radius.pill,
        borderWidth: 1, borderColor: disabled ? palette.border.subtle : palette.border.default,
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text variant="body-lg" tone="primary" weight="semibold">{label}</Text>
    </Pressable>
  );
}
