import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { formatPrice } from '../../../features/discover/format';
import { Icon } from '../../../features/icon/Icon';
import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
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
  const [refreshing, setRefreshing] = useState(false);

  const isSignedIn = status === 'signed-in';

  const onRefresh = useCallback(async () => {
    // Light tap at the start so the pull feels "registered," success notification
    // once new data lands. Errors don't notify — RefreshControl already snaps back.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      await refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

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
      <StatusBarBackdrop />
    </View>
  );
}

/**
 * Credit balance card. Placeholder for now — the credit system isn't built
 * yet, so we render a quiet zero-state that explains what'll go here. When
 * referrals / refunds / gifts land, this card grows up.
 */
function CreditSection() {
  const { color: palette } = useTheme();
  // Hardcoded to 0 until the credit system ships. Once it does, this becomes a
  // trpc.credits.balance.useQuery().
  const balanceCents = 0;
  if (balanceCents === 0) return null;
  return (
    <View
      style={{
        backgroundColor: palette.brand[50],
        borderRadius: radius.lg,
        padding: space[5],
        borderWidth: 1,
        borderColor: palette.brand[100],
      }}
    >
      <Stack gap={1}>
        <Text variant="label" weight="medium" style={{ color: palette.brand[700] }}>
          GLOĒ CREDIT
        </Text>
        <Text variant="display-md" weight="semibold" style={{ color: palette.brand[700] }}>
          {formatPrice(balanceCents)}
        </Text>
      </Stack>
    </View>
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
  dim,
}: {
  claim: ClaimedDeal;
  onPress: () => void;
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

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        padding: space[4],
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        opacity: dim ? 0.6 : 1,
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
