import { Button, Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { formatPrice } from '../../../features/discover/format';
import { ReviewSheet } from '../../../features/reviews/ReviewSheet';

/**
 * The voucher screen — what a customer shows to the spa to get their service.
 * This is the most emotionally important screen in the consumer app: it's the
 * "I'm about to walk in and get my deal" moment. Treat it like a ticket.
 *
 * Three visual states:
 *   - active   → big QR, code below, expires-in countdown, "How to use" steps
 *   - redeemed → checkmark hero (no QR), "thanks" tone, review/rebook CTAs
 *   - expired  → quiet "expired" state, link to similar deals
 */
export default function MyDealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getById, markRedeemed } = useClaimedDeals();
  const { color: palette } = useTheme();
  const [, forceTick] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const claim = id ? getById(id) : undefined;

  // Re-render every minute so the countdown updates.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!claim) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.surface.primary, alignItems: 'center', justifyContent: 'center', padding: space[6] }}>
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
  const isExpired = !isRedeemed && expiresInMs <= 0;
  const isActive = !isRedeemed && !isExpired;

  const statusLabel = isRedeemed ? 'REDEEMED' : isExpired ? 'EXPIRED' : 'YOUR DEAL';

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[3],
          paddingBottom: insets.bottom + space[8],
          paddingHorizontal: space[5],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={6}>
          {/* Top bar: Done left, status pill right */}
          <Stack direction="row" justify="space-between" align="center">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text variant="body-md" tone="secondary" weight="medium">← Done</Text>
            </Pressable>
            <StatusPill label={statusLabel} kind={isRedeemed ? 'success' : isExpired ? 'error' : 'neutral'} />
          </Stack>

          {/* Title block — vendor name in display serif with sparkle accents */}
          <Stack gap={1} align="center">
            <Stack direction="row" align="center" gap={2}>
              <Text variant="body-sm" tone="brand" weight="semibold">✦</Text>
              <Text variant="display-md" tone="primary" weight="medium" align="center" style={{ letterSpacing: 0.2 }}>
                {snapshot.vendorName ?? 'Vendor'}
              </Text>
              <Text variant="body-sm" tone="brand" weight="semibold">✦</Text>
            </Stack>
            <Text variant="body-md" tone="secondary" align="center">
              {snapshot.dealTitle}
            </Text>
            <Text variant="body-sm" tone="tertiary" align="center">
              {snapshot.variantLabel}
            </Text>
          </Stack>

          {/* The ticket card — QR + code + price, all in one. THE hero. */}
          <View
            style={{
              backgroundColor: palette.surface.elevated,
              borderRadius: radius['2xl'],
              padding: space[6],
              alignItems: 'center',
              ...shadow.md,
              opacity: isActive ? 1 : 0.55,
            }}
          >
            {/* QR for active, checkmark for redeemed, X for expired */}
            {isActive ? (
              <QRCode
                value={claim.qrPayload}
                size={232}
                color={palette.text.primary}
                backgroundColor={palette.surface.elevated}
                quietZone={8}
              />
            ) : isRedeemed ? (
              <RedeemedBadge />
            ) : (
              <ExpiredBadge />
            )}

            {/* Human-readable code, big & spaced — for when QR scans fail */}
            <Stack gap={1} align="center" style={{ marginTop: space[5] }}>
              <Text variant="caption" tone="tertiary" weight="semibold" style={{ letterSpacing: 1.5 }}>
                {isActive ? 'CODE' : 'WAS'}
              </Text>
              <Text
                variant="display-sm"
                tone="primary"
                weight="semibold"
                align="center"
                style={{ letterSpacing: 3, fontVariant: ['tabular-nums'] }}
              >
                {claim.humanCode ?? '—'}
              </Text>
            </Stack>

            {/* Divider */}
            <View
              style={{
                height: 1,
                width: '100%',
                backgroundColor: palette.border.subtle,
                marginVertical: space[5],
              }}
            />

            {/* Price row — what they paid + what they saved */}
            <Stack direction="row" justify="space-between" align="baseline" style={{ width: '100%' }}>
              <Text variant="body-md" tone="secondary" weight="medium">
                {isRedeemed ? 'You paid' : 'You pay'}
              </Text>
              <Stack direction="row" gap={2} align="baseline">
                <Text variant="display-sm" tone="primary" weight="semibold">
                  {formatPrice(snapshot.dealPriceCents)}
                </Text>
                {snapshot.originalPriceCents > snapshot.dealPriceCents ? (
                  <Text
                    variant="body-sm"
                    tone="tertiary"
                    style={{ textDecorationLine: 'line-through' }}
                  >
                    {formatPrice(snapshot.originalPriceCents)}
                  </Text>
                ) : null}
              </Stack>
            </Stack>
            {snapshot.originalPriceCents > snapshot.dealPriceCents ? (
              <Text
                variant="caption"
                tone="brand"
                weight="semibold"
                align="right"
                style={{ width: '100%', marginTop: 2 }}
              >
                You saved {formatPrice(snapshot.originalPriceCents - snapshot.dealPriceCents)}
              </Text>
            ) : null}
          </View>

          {/* State-specific body content */}
          {isActive ? (
            <ActiveBody expiresInMs={expiresInMs} />
          ) : isRedeemed ? (
            <RedeemedBody vendorName={snapshot.vendorName ?? 'the spa'} redeemedAt={claim.redeemedAt} />
          ) : (
            <ExpiredBody expiresAt={claim.expiresAt} />
          )}

          {/* Dev-only: simulate redemption (until vendor scanner is in vendors' hands) */}
          {isActive ? (
            <Button
              label="Simulate redemption"
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                markRedeemed(claim.id);
              }}
            />
          ) : null}

          {/* Post-redemption review CTA. Only shows after they've used the
              voucher — you can't review a service you didn't get. The sheet
              prefills if they've already left one (idempotent on claim_id). */}
          {isRedeemed ? (
            <Button
              label="Leave a review"
              variant="primary"
              size="md"
              fullWidth
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setReviewOpen(true);
              }}
            />
          ) : null}

          {/* "Visit the spa" CTA — relevant in every state. After redemption
              this is the doorway back into their relationship with this vendor:
              re-book, see other deals, follow on Instagram. */}
          {snapshot.vendorId ? (
            <Button
              label={`Visit ${snapshot.vendorName ?? 'the vendor'}`}
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => router.push(`/(app)/vendor/${snapshot.vendorId}`)}
            />
          ) : null}

          <Text variant="caption" tone="tertiary" align="center">
            Code is unique to your account. Do not share.
          </Text>
        </Stack>
      </ScrollView>

      <ReviewSheet
        open={reviewOpen}
        claimId={claim.id}
        vendorName={snapshot.vendorName ?? 'the vendor'}
        onClose={() => setReviewOpen(false)}
      />
    </View>
  );
}

/* ─────────────── sub-components ─────────────── */

function StatusPill({ label, kind }: { label: string; kind: 'success' | 'error' | 'neutral' }) {
  const { color: palette } = useTheme();
  const bg = kind === 'success' ? palette.semantic.success
    : kind === 'error' ? palette.semantic.error
    : palette.surface.secondary;
  const fg = kind === 'neutral' ? palette.text.tertiary : palette.text.inverse;
  return (
    <View style={{
      paddingHorizontal: space[3],
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: bg,
    }}>
      <Text variant="caption" weight="semibold" style={{ color: fg, letterSpacing: 1.2, fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}

function RedeemedBadge() {
  const { color: palette } = useTheme();
  return (
    <View style={{
      width: 232,
      height: 232,
      borderRadius: 116,
      backgroundColor: palette.semantic.success + '15',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <View style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: palette.semantic.success,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 64, color: '#fff', lineHeight: 72, marginTop: -4 }}>✓</Text>
      </View>
    </View>
  );
}

function ExpiredBadge() {
  const { color: palette } = useTheme();
  return (
    <View style={{
      width: 232,
      height: 232,
      borderRadius: 116,
      backgroundColor: palette.surface.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 64, color: palette.text.tertiary, lineHeight: 72 }}>⏳</Text>
    </View>
  );
}

function ActiveBody({ expiresInMs }: { expiresInMs: number }) {
  const { color: palette } = useTheme();
  const urgent = expiresInMs < 24 * 60 * 60 * 1000; // < 24h
  return (
    <Stack gap={5}>
      <Stack direction="row" justify="center" align="center" gap={2}>
        <Text variant="body-sm" tone={urgent ? 'error' : 'secondary'} weight="medium">
          ⏱  Expires in {formatRelative(expiresInMs)}
        </Text>
      </Stack>

      <View style={{
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        padding: space[5],
      }}>
        <Text variant="caption" tone="tertiary" weight="semibold" style={{ letterSpacing: 1.5, marginBottom: space[3] }}>
          HOW TO USE
        </Text>
        <Stack gap={3}>
          <Step n={1} text="Show this code at the front desk when you arrive" />
          <Step n={2} text="The staff scans it, you save instantly" />
          <Step n={3} text="Enjoy ✨" />
        </Stack>
      </View>
    </Stack>
  );
}

function RedeemedBody({ vendorName, redeemedAt }: { vendorName: string; redeemedAt: number | null }) {
  return (
    <Stack gap={3} align="center">
      <Text variant="body-md" tone="primary" weight="semibold" align="center">
        Hope you loved it ✨
      </Text>
      <Text variant="body-sm" tone="secondary" align="center">
        {redeemedAt
          ? `Used at ${vendorName} on ${formatDateTime(redeemedAt)}.`
          : `Used at ${vendorName}.`}
      </Text>
    </Stack>
  );
}

function ExpiredBody({ expiresAt }: { expiresAt: number }) {
  return (
    <Stack gap={2} align="center">
      <Text variant="body-md" tone="secondary" align="center">
        This voucher expired on {formatDateTime(expiresAt)}.
      </Text>
      <Text variant="body-sm" tone="tertiary" align="center">
        Browse Discover for similar deals near you.
      </Text>
    </Stack>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const { color: palette } = useTheme();
  return (
    <Stack direction="row" align="flex-start" gap={3}>
      <View style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: palette.brand[500],
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
      }}>
        <Text variant="caption" weight="bold" style={{ color: '#fff', fontSize: 12 }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body-md" tone="primary">{text}</Text>
      </View>
    </Stack>
  );
}

/* ─────────────── formatting helpers ─────────────── */

function formatRelative(ms: number): string {
  if (ms <= 0) return 'now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
