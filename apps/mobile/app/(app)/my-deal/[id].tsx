import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { trpc } from '@gloe/api-client';
import { Button, Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import PassKit from 'react-native-passkit-wallet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import { getApiUrl } from '../../../features/api/apiUrl';
import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { formatPrice } from '../../../features/discover/format';
import { useToast } from '../../../features/feedback/Toast';
import { Icon } from '../../../features/icon/Icon';
import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
import { ReviewSheet } from '../../../features/reviews/ReviewSheet';
import { AddToWalletBadge } from '../../../features/wallet/AddToWalletBadge';

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
  const { id, review } = useLocalSearchParams<{ id: string; review?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getById, refetch } = useClaimedDeals();
  const { color: palette } = useTheme();
  const [, forceTick] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const claim = id ? getById(id) : undefined;

  // Auto-open the review sheet when arriving from the review-prompt push
  // (deep link adds ?review=1). Only once, and only for a redeemed voucher.
  useEffect(() => {
    if (review === '1' && claim?.status === 'redeemed') setReviewOpen(true);
  }, [review, claim?.status]);

  // Fetch live vendor info (phone, address, coords) for the Call + Directions
  // quick-action buttons. The cached list claim doesn't include these — they
  // come from a live JOIN on the vendors table — so we fetch byId in parallel.
  // React Query dedupes; the screen renders instantly from cache and the
  // action buttons enable as soon as this lands (~200ms).
  const detailQuery = trpc.claims.byId.useQuery(
    { id: id ?? '' },
    { enabled: !!id, staleTime: 60_000 },
  );
  const liveVendor = detailQuery.data?.vendor;

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

          {/* Title block — compact: vendor (display serif) over a single
              "deal · variant" line. Skips the side sparkle accents to claw
              back vertical space and keep the QR card above the fold. */}
          <Stack gap={1} align="center">
            <Text
              variant="display-md"
              tone="primary"
              weight="medium"
              align="center"
              numberOfLines={1}
              style={{ letterSpacing: 0.2 }}
            >
              {snapshot.vendorName ?? 'Vendor'}
            </Text>
            <Text variant="body-sm" tone="secondary" align="center" numberOfLines={1}>
              {snapshot.dealTitle}
              {snapshot.variantLabel ? ` · ${snapshot.variantLabel}` : ''}
            </Text>
          </Stack>

          {/* The ticket card — QR + code + price, all in one. THE hero.
              Sized so the card + Apple Wallet button fit above the fold on
              an iPhone SE; a 192pt QR scans reliably from ~6+ inches. */}
          <View
            style={{
              backgroundColor: palette.surface.elevated,
              borderRadius: radius['2xl'],
              padding: space[5],
              alignItems: 'center',
              ...shadow.md,
              opacity: isActive ? 1 : 0.55,
            }}
          >
            {/* QR for active, checkmark for redeemed, X for expired */}
            {isActive ? (
              <QRCode
                value={claim.qrPayload}
                size={192}
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
            <Stack gap={1} align="center" style={{ marginTop: space[3] }}>
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
                marginVertical: space[4],
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

          {/* In-the-moment actions, in order of urgency at the spa counter:
              quick contact (Call/Directions) → save-for-later (Wallet). All
              three sit right under the QR card so the user never has to scroll
              past the instructions to get to them. */}
          <QuickActionsRow
            phone={liveVendor?.phone ?? null}
            address={liveVendor?.address ?? null}
            lat={liveVendor?.lat ?? null}
            lng={liveVendor?.lng ?? null}
            vendorName={snapshot.vendorName ?? 'the vendor'}
          />

          {/* "Add to Apple Wallet" — lock-screen access to the voucher, plus
              auto-surface when near the vendor (set server-side via the pass's
              relevant location). Active vouchers only. */}
          {isActive ? <AddToWalletButton claimId={claim.id} /> : null}

          {/* State-specific body content (Expires-in + How-to-use steps for
              active; thank-you for redeemed; quiet message for expired). */}
          {isActive ? (
            <ActiveBody expiresInMs={expiresInMs} />
          ) : isRedeemed ? (
            <RedeemedBody vendorName={snapshot.vendorName ?? 'the spa'} redeemedAt={claim.redeemedAt} />
          ) : (
            <ExpiredBody expiresAt={claim.expiresAt} />
          )}

          {/* Redemption is vendor-only: the vendor scans the QR (or enters the
              code) in their scanner to mark this voucher redeemed. The customer
              cannot self-redeem — that would let a payout fire without anyone
              showing up. The screen only *displays* the QR + code above. */}

          {/* Post-redemption review CTA. Only shows after they've used the
              voucher — you can't review a service you didn't get. The sheet
              prefills if they've already left one (idempotent on claim_id). */}
          {isRedeemed ? (
            <Button
              label={claim.hasReview ? 'Edit your review' : 'Leave a review'}
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
        onSaved={() => {
          void refetch();
        }}
      />
      <StatusBarBackdrop />
    </View>
  );
}

/* ─────────────── sub-components ─────────────── */

/**
 * Call + Directions buttons under the QR card. Disabled (greyed) when the
 * live vendor info hasn't loaded yet. Tapping Call opens the system dialer;
 * tapping Directions opens Apple Maps with a destination set (coords if we
 * have them, otherwise a free-text address search).
 */
function QuickActionsRow({
  phone,
  address,
  lat,
  lng,
  vendorName,
}: {
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  vendorName: string;
}) {
  const { color: palette } = useTheme();
  const canCall = !!phone;
  const canNavigate = (lat != null && lng != null) || !!address;

  const onCall = async () => {
    if (!phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // tel: scheme — iOS shows the call-confirmation sheet automatically.
    const cleaned = phone.replace(/[^\d+]/g, '');
    await Linking.openURL(`tel:${cleaned}`);
  };

  const onDirections = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Prefer Apple Maps deep link with coords (most precise). Fall back to
    // address search if coords are missing.
    const label = encodeURIComponent(vendorName);
    let url: string;
    if (lat != null && lng != null) {
      url = Platform.select({
        ios: `maps://?daddr=${lat},${lng}&q=${label}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      }) ?? `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
    } else if (address) {
      const q = encodeURIComponent(address);
      url = Platform.select({
        ios: `maps://?daddr=${q}`,
        android: `geo:0,0?q=${q}`,
      }) ?? `https://maps.apple.com/?daddr=${q}`;
    } else {
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <Stack direction="row" gap={3}>
      <QuickActionCard
        icon="phone"
        label="Call"
        onPress={onCall}
        disabled={!canCall}
        palette={palette}
      />
      <QuickActionCard
        icon="map-pin"
        label="Directions"
        onPress={onDirections}
        disabled={!canNavigate}
        palette={palette}
      />
    </Stack>
  );
}

function QuickActionCard({
  icon,
  label,
  onPress,
  disabled,
  palette,
}: {
  icon: 'phone' | 'map-pin';
  label: string;
  onPress: () => void;
  disabled: boolean;
  palette: ReturnType<typeof useTheme>['color'];
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        paddingVertical: space[4],
        alignItems: 'center',
        gap: space[1],
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon name={icon} size={22} color={palette.brand[500]} strokeWidth={1.75} />
      <Text variant="body-sm" tone="primary" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Add-to-Wallet button using Apple's native PKAddPassButton + PKAddPassesViewController.
 * On tap: fetch the .pkpass bytes from our API (Bearer auth), base64-encode,
 * hand to PassKit. iOS shows the system "Add to Apple Wallet" sheet in-app —
 * no Safari detour. The button itself is the actual Apple UIKit system view,
 * so its rendering tracks iOS version/locale/dynamic-type automatically.
 */
function AddToWalletButton({ claimId }: { claimId: string }) {
  const [busy, setBusy] = useState(false);
  const { getToken } = useClerkAuth();
  const toast = useToast();

  const onPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch(`${getApiUrl()}/pass/${claimId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Pass download failed (${res.status}): ${body.slice(0, 120)}`);
      }
      // iOS PassKit takes a base64 string of the .pkpass bytes and shows the
      // system add-pass sheet. RN doesn't have a built-in Buffer; assemble
      // base64 ourselves from the ArrayBuffer.
      const buf = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      await PassKit.addPass(base64);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // PassKit.addPass resolves when the user dismisses the sheet either way
      // (Add or Cancel). We can't distinguish — show a friendly success that
      // also offers a one-tap jump to the Wallet app. If they cancelled they'll
      // know; the toast is subtle enough not to be annoying.
      toast.show({
        kind: 'success',
        message: 'Added to Apple Wallet',
        action: {
          label: 'Open Wallet',
          onPress: () => {
            void Linking.openURL('shoebox://');
          },
        },
      });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Couldn’t add to Apple Wallet',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <AddToWalletBadge onPress={onPress} disabled={busy} />
    </View>
  );
}


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

/* ─────────────── helpers ─────────────── */

/**
 * Convert raw bytes to base64 — needed because RN doesn't ship a global Buffer
 * and PassKit.addPass expects a base64 string. Iterates in 32KB chunks so
 * String.fromCharCode.apply doesn't blow the call-stack on large pass files.
 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return global.btoa(binary);
}

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
