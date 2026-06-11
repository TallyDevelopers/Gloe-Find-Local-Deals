import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { Icon } from '../../../features/icon/Icon';
import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
import { ReviewSheet } from '../../../features/reviews/ReviewSheet';
import { CreditHistorySheet } from '../../../features/wallet/CreditHistorySheet';
import { formatCredit, formatCreditDate } from '../../../features/wallet/creditFormat';
import type { ClaimedDeal } from '../../../features/claimed/types';

/**
 * Wallet — "things that are mine, ready to use."
 *
 * Three sections, in order of usefulness in the moment:
 *   1. Credit balance (when we ship the credit system) — frictionless to spend
 *   2. Active vouchers — sorted by soonest to expire so the urgent one is first
 *   3. Past — collapsed historical record (redeemed + expired)
 *
 * The single most important interaction: a customer walking into a spa needs
 * their QR in 2 seconds. The top active voucher gets a hero treatment with a
 * tap-anywhere-on-the-card → /my-deal/[id] route. No nested taps.
 */
export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useAuth();
  const { color: palette } = useTheme();
  const { activeClaims, pastClaims, refetch } = useClaimedDeals();
  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  // The claim whose review sheet is open (null = closed). Driven from the
  // "leave a review" nudge on redeemed-and-unreviewed past vouchers.
  const [reviewClaim, setReviewClaim] = useState<ClaimedDeal | null>(null);

  const isSignedIn = status === 'signed-in';

  const onRefresh = useCallback(async () => {
    // Light tap at the start so the pull feels "registered," success notification
    // once new data lands. Errors don't notify — RefreshControl already snaps back.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      // Credit balance rides along — a referral landing or expiry should show
      // up on the same pull that refreshes vouchers.
      await Promise.all([refetch(), utils.credits.invalidate()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, utils]);

  // Soonest expiring first — the one they probably need right now sits at the top.
  const sortedActive = useMemo(
    () => [...activeClaims].sort((a, b) => a.expiresAt - b.expiresAt),
    [activeClaims],
  );
  const [hero, ...rest] = sortedActive;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isSignedIn ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand[500]}
              progressViewOffset={insets.top}
            />
          ) : undefined
        }
      >
        <Stack gap={6}>
          <Stack gap={1}>
            <Text variant="display-lg" tone="primary" weight="medium">
              Wallet
            </Text>
            <Text variant="body-md" tone="secondary">
              Your credit and ready-to-use bookings.
            </Text>
          </Stack>

          {!isSignedIn ? (
            <SignInGate onSignIn={() => router.push('/(auth)/login')} />
          ) : (
            <>
              <CreditSection />

              {hero ? (
                <Stack gap={3}>
                  <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
                    READY TO REDEEM
                  </Text>
                  <HeroVoucherCard
                    claim={hero}
                    onPress={() => router.push(`/(app)/my-deal/${hero.id}`)}
                  />
                </Stack>
              ) : (
                <EmptyState onBrowse={() => router.push('/(app)/(tabs)/discover')} />
              )}

              {rest.length > 0 ? (
                <Stack gap={3}>
                  <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
                    MORE VOUCHERS
                  </Text>
                  <Stack gap={2}>
                    {rest.map((claim) => (
                      <VoucherRow
                        key={claim.id}
                        claim={claim}
                        onPress={() => router.push(`/(app)/my-deal/${claim.id}`)}
                      />
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {pastClaims.length > 0 ? (
                <Stack gap={3}>
                  <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
                    PAST
                  </Text>
                  <Stack gap={2}>
                    {pastClaims
                      .slice()
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((claim) => (
                        <VoucherRow
                          key={claim.id}
                          claim={claim}
                          onPress={() => router.push(`/(app)/my-deal/${claim.id}`)}
                          onReview={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setReviewClaim(claim);
                          }}
                          dim
                        />
                      ))}
                  </Stack>
                </Stack>
              ) : null}
            </>
          )}
        </Stack>
      </ScrollView>

      {/* Review sheet, opened from the "Share your experience" nudges. Refetch on
          save so the reviewed claim drops out of the list immediately. */}
      <ReviewSheet
        open={reviewClaim !== null}
        claimId={reviewClaim?.id ?? ''}
        vendorName={reviewClaim?.snapshot.vendorName ?? 'the vendor'}
        onClose={() => setReviewClaim(null)}
        onSaved={() => {
          void refetch();
        }}
      />
      <StatusBarBackdrop />
    </View>
  );
}

/**
 * Credit balance card + invite promo. The balance card only renders when
 * there's credit (available or locked) and opens the full ledger history
 * sheet on tap; the "Give $20, get $20" promo card always shows and routes
 * to the referral share screen. Brand palette throughout — credit is a
 * brand moment, not a semantic-success one.
 */
function CreditSection() {
  const { color: palette } = useTheme();
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const balance = trpc.credits.balance.useQuery();

  const b = balance.data;
  const hasCredit = !!b && (b.availableCents > 0 || b.lockedCents > 0);
  // Only nag about expiry when it's actually close (30 days out).
  const expiring =
    b?.soonestExpiry &&
    new Date(b.soonestExpiry.expiresAt).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000
      ? b.soonestExpiry
      : null;

  return (
    <Stack gap={3}>
      {hasCredit ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setHistoryOpen(true);
          }}
          style={{
            backgroundColor: palette.brand[50],
            borderRadius: radius.lg,
            padding: space[5],
            borderWidth: 1,
            borderColor: palette.brand[100],
          }}
        >
          <Stack direction="row" align="center" gap={3}>
            <Stack gap={1} style={{ flex: 1 }}>
              <Text variant="label" weight="medium" style={{ color: palette.brand[700] }}>
                GLOĒ CREDIT
              </Text>
              <Text variant="display-md" weight="semibold" style={{ color: palette.brand[700] }}>
                {formatCredit(b.availableCents)}
              </Text>
              {b.lockedCents > 0 ? (
                <Text variant="body-sm" style={{ color: palette.brand[600] }}>
                  +{formatCredit(b.lockedCents)} unlocks on your first booking
                  {b.lockedFloorCents > 0 ? ` of ${formatCredit(b.lockedFloorCents)}+` : ''}
                </Text>
              ) : null}
              {expiring ? (
                <Text variant="body-sm" style={{ color: palette.brand[600] }}>
                  {formatCredit(expiring.amountCents)} expires {formatCreditDate(expiring.expiresAt)}
                </Text>
              ) : null}
            </Stack>
            <Icon name="chevronRight" size={18} color={palette.brand[400]} />
          </Stack>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(app)/referral');
        }}
        style={{
          backgroundColor: palette.surface.elevated,
          borderRadius: radius.lg,
          padding: space[4],
          borderWidth: 1,
          borderColor: palette.brand[100],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: palette.brand[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="gift" size={20} color={palette.brand[600]} />
        </View>
        <Stack gap={0} style={{ flex: 1 }}>
          <Text variant="body-md" tone="primary" weight="semibold">
            Give $20, get $20
          </Text>
          <Text variant="body-sm" tone="secondary">
            Invite friends — you both get Gloē credit
          </Text>
        </Stack>
        <Icon name="chevronRight" size={18} color={palette.text.tertiary} />
      </Pressable>

      <CreditHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Stack>
  );
}

function HeroVoucherCard({ claim, onPress }: { claim: ClaimedDeal; onPress: () => void }) {
  const { color: palette } = useTheme();
  const expiresIn = formatExpiry(claim.expiresAt);
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        padding: space[5],
        borderWidth: 1,
        borderColor: palette.border.subtle,
      }}
    >
      <Stack gap={5}>
        <Stack gap={2}>
          <Text variant="caption" tone="tertiary" weight="medium">
            {claim.snapshot.vendorName.toUpperCase()}
          </Text>
          <Text variant="display-sm" tone="primary" weight="medium" numberOfLines={2}>
            {claim.snapshot.dealTitle}
          </Text>
          <Text variant="body-md" tone="secondary">
            {claim.snapshot.variantLabel}
          </Text>
        </Stack>

        <Stack direction="row" align="center" justify="space-between">
          <Stack gap={1}>
            <Text variant="caption" tone="tertiary" weight="medium">
              EXPIRES
            </Text>
            <Text variant="body-md" tone="primary" weight="semibold">
              {expiresIn}
            </Text>
          </Stack>
          <View
            style={{
              backgroundColor: palette.brand[500],
              paddingVertical: space[3],
              paddingHorizontal: space[5],
              borderRadius: radius.pill,
            }}
          >
            <Text variant="body-md" tone="inverse" weight="semibold">
              Show QR
            </Text>
          </View>
        </Stack>
      </Stack>
    </Pressable>
  );
}

function VoucherRow({
  claim,
  onPress,
  onReview,
  dim,
}: {
  claim: ClaimedDeal;
  onPress: () => void;
  /** When set + the claim is redeemed-and-unreviewed, an inline review prompt is shown. */
  onReview?: () => void;
  dim?: boolean;
}) {
  const { color: palette } = useTheme();
  const isRedeemed = claim.status === 'redeemed';
  const isExpired = claim.status === 'expired' || (claim.status === 'active' && claim.expiresAt < Date.now());
  const subline = isRedeemed
    ? 'Redeemed'
    : isExpired
      ? 'Expired'
      : formatExpiry(claim.expiresAt);
  // Show the inline "leave a review" prompt right under any redeemed voucher
  // that hasn't been reviewed yet — so it's one row per deal, no separate
  // section and no extra scrolling no matter how many redemptions you have.
  const canReview = !!onReview && isRedeemed && !claim.hasReview;
  // A voucher inviting a review shouldn't look faded/"past" — keep it bright so
  // the prompt reads as a live call to action, not archived history.
  const dimmed = dim && !canReview;

  return (
    <View
      style={{
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: canReview ? palette.brand[100] : palette.border.subtle,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onPress}
        style={{
          padding: space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          opacity: dimmed ? 0.6 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <Stack gap={1}>
            <Text variant="caption" tone="tertiary" weight="medium" numberOfLines={1}>
              {claim.snapshot.vendorName}
            </Text>
            <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
              {claim.snapshot.dealTitle}
            </Text>
            <Text variant="body-sm" tone="secondary">
              {subline}
            </Text>
          </Stack>
        </View>
        <Icon name="chevronRight" size={18} color={palette.text.tertiary} />
      </Pressable>

      {canReview ? (
        <Pressable
          onPress={onReview}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            paddingVertical: space[3] + 2,
            paddingHorizontal: space[4],
            borderTopWidth: 1,
            borderTopColor: palette.brand[100],
            backgroundColor: palette.brand[100],
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 18, color: palette.brand[700] }}>★</Text>
          <Text variant="body-sm" weight="semibold" style={{ color: palette.brand[700], flex: 1 }} numberOfLines={1}>
            How was {claim.snapshot.vendorName}? Leave a review
          </Text>
          <Icon name="chevronRight" size={16} color={palette.brand[700]} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[12] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: palette.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="tab.wallet" size={44} color={palette.brand[500]} strokeWidth={1.75} />
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 320 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          Nothing here yet
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          Your vouchers and bookings will live here, ready to show at the spa.
        </Text>
      </Stack>
      <View style={{ width: '100%', maxWidth: 320 }}>
        <Button label="Browse deals" onPress={onBrowse} size="lg" fullWidth />
      </View>
    </Stack>
  );
}

function SignInGate({ onSignIn }: { onSignIn: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[12] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: palette.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="tab.wallet" size={44} color={palette.brand[500]} strokeWidth={1.75} />
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 320 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          Sign in to see your wallet
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          Your vouchers, credit, and booking history — all in one place.
        </Text>
      </Stack>
      <View style={{ width: '100%', maxWidth: 320 }}>
        <Button label="Sign in" onPress={onSignIn} size="lg" fullWidth />
      </View>
    </Stack>
  );
}

/**
 * Human-readable "expires in" countdown. Tuned for the wallet glance — most
 * people want "tomorrow" / "in 3 days," not "1d 4h 22m."
 */
function formatExpiry(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return `Today · ${hours}h left`;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
  return `In ${Math.floor(days / 30)} months`;
}
