import { trpc } from '@gloe/api-client';
import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../features/icon/Icon';
import { formatCredit } from '../../features/wallet/creditFormat';

/**
 * Referral share screen — "Give $20, get $20." Personal code front and
 * center, one big share button (native share sheet with the gloe.app/r/CODE
 * link), and a quiet scoreboard of how the invites are going. Amounts come
 * from the live referral rule so god-mode edits show up without a release;
 * $20/$20 is only the loading fallback.
 */
export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { color: palette } = useTheme();

  const codeQuery = trpc.referral.getCode.useQuery();
  const program = trpc.referral.program.useQuery();
  const status = trpc.referral.status.useQuery();
  const [sharing, setSharing] = useState(false);

  const giveLabel = program.data ? formatCredit(program.data.giveCents) : '$20';
  const getLabel = program.data ? formatCredit(program.data.getCents) : '$20';
  const floorLabel = program.data?.minFirstPurchaseCents
    ? formatCredit(program.data.minFirstPurchaseCents)
    : '$50';

  const handleShare = async () => {
    if (!codeQuery.data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSharing(true);
    try {
      // `url` renders as a rich preview card on iOS; the message sits above it.
      await Share.share({
        message: `${giveLabel} toward your first booking on Gloē — use my invite ✨`,
        url: codeQuery.data.url,
      });
    } finally {
      setSharing(false);
    }
  };

  const s = status.data;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      {/* Header with back button — matches the checkout screen chrome. */}
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
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.surface.secondary,
          }}
        >
          <Text variant="body-lg" tone="primary" weight="semibold">‹</Text>
        </Pressable>
        <Text variant="display-sm" tone="primary" weight="medium">Invite friends</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space[6], paddingBottom: insets.bottom + space[8] }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={6}>
          {/* Hero — the pitch */}
          <Stack gap={4} align="center" style={{ paddingTop: space[4] }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: palette.brand[50],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="gift" size={40} color={palette.brand[500]} strokeWidth={1.75} />
            </View>
            <Stack gap={2} align="center" style={{ maxWidth: 320 }}>
              <Text variant="display-md" tone="primary" weight="medium" align="center">
                Give {giveLabel}, get {getLabel}
              </Text>
              <Text variant="body-md" tone="secondary" align="center">
                Friends get {giveLabel} toward their first booking of {floorLabel}+. You get{' '}
                {getLabel} in Gloē credit when they book.
              </Text>
            </Stack>
          </Stack>

          {/* Personal code */}
          <View
            style={{
              backgroundColor: palette.brand[50],
              borderRadius: radius.lg,
              padding: space[5],
              borderWidth: 1,
              borderColor: palette.brand[100],
              alignItems: 'center',
              gap: space[1],
            }}
          >
            <Text variant="label" weight="medium" style={{ color: palette.brand[700] }}>
              YOUR CODE
            </Text>
            {codeQuery.isLoading ? (
              <ActivityIndicator color={palette.brand[500]} style={{ paddingVertical: space[2] }} />
            ) : (
              <Text
                variant="display-md"
                weight="semibold"
                style={{ color: palette.brand[700], letterSpacing: 4 }}
              >
                {codeQuery.data?.code ?? '——————'}
              </Text>
            )}
            <Text variant="body-sm" style={{ color: palette.brand[600] }} numberOfLines={1}>
              {codeQuery.data?.url.replace('https://', '') ?? 'gloe.app/r/…'}
            </Text>
          </View>

          <Button
            label={sharing ? 'Opening share sheet…' : 'Share your link'}
            size="lg"
            fullWidth
            onPress={handleShare}
            disabled={sharing || !codeQuery.data}
            loading={sharing}
          />

          {/* Scoreboard — invited / booked / earned */}
          <Stack gap={3}>
            <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
              YOUR INVITES
            </Text>
            {status.isLoading ? (
              <View style={{ paddingVertical: space[6], alignItems: 'center' }}>
                <ActivityIndicator color={palette.brand[500]} />
              </View>
            ) : s && (s.invited > 0 || s.qualified > 0) ? (
              <View
                style={{
                  backgroundColor: palette.surface.elevated,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: palette.border.subtle,
                  overflow: 'hidden',
                }}
              >
                <StatusRow
                  label="Invited"
                  sublabel="Signed up, no booking yet"
                  value={String(s.invited)}
                />
                <StatusRow
                  label="Booked"
                  sublabel="Made their first booking"
                  value={String(s.qualified)}
                />
                <StatusRow
                  label="You earned"
                  sublabel="Gloē credit from referrals"
                  value={formatCredit(s.earnedCents)}
                  emphasize
                  last
                />
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: palette.surface.elevated,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: palette.border.subtle,
                  padding: space[5],
                }}
              >
                <Text variant="body-md" tone="secondary" align="center">
                  No invites yet — share your code to start earning.
                </Text>
              </View>
            )}
          </Stack>

          {/* The fine print, human-sized */}
          <Text variant="caption" tone="tertiary" align="center" style={{ maxWidth: 320, alignSelf: 'center' }}>
            Your friend's credit applies automatically at checkout on a first booking of{' '}
            {floorLabel} or more. Credit expires if unused — check your wallet for dates.
          </Text>
        </Stack>
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  sublabel,
  value,
  emphasize,
  last,
}: {
  label: string;
  sublabel: string;
  value: string;
  emphasize?: boolean;
  last?: boolean;
}) {
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        paddingVertical: space[4],
        paddingHorizontal: space[5],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border.subtle,
      }}
    >
      <Stack gap={0} style={{ flex: 1 }}>
        <Text variant="body-md" tone="primary" weight="medium">{label}</Text>
        <Text variant="body-sm" tone="tertiary">{sublabel}</Text>
      </Stack>
      <Text
        variant="body-lg"
        weight="semibold"
        style={{ color: emphasize ? palette.brand[700] : palette.text.primary }}
      >
        {value}
      </Text>
    </View>
  );
}
