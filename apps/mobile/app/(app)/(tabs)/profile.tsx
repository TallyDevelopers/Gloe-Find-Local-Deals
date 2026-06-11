import { trpc } from '@gloe/api-client';
import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaimedDeals } from '../../../features/claimed/ClaimedDealsProvider';
import { Icon } from '../../../features/icon/Icon';
import { CachedImage } from '../../../features/image/CachedImage';
import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
import { usePrefetch } from '../../../features/prefetch/usePrefetch';
import { useSupport, type SupportTicketSummary } from '../../../features/support/SupportProvider';

// App version for the About row. Read from the bundled manifest (no native dep).
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.1';
// Replace with the real App Store ID once the app is live; until then the row
// still opens the App Store search gracefully.
const APP_STORE_REVIEW_URL = 'https://apps.apple.com/app/idYOUR_APP_ID?action=write-review';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const { color: palette } = useTheme();
  const { activeClaims } = useClaimedDeals();
  const { tickets } = useSupport();
  const prefetch = usePrefetch();

  const isSignedIn = status === 'signed-in';

  // Surface the most-recent OPEN ticket as a live card so support feels like an
  // ongoing conversation, not a buried menu item. tickets is newest-first.
  const activeTicket = tickets.find((t) => t.status !== 'resolved' && t.status !== 'closed');

  // Account deletion (Apple 5.1.1(v)). Double-confirm because it's permanent,
  // then sign out locally once the server has anonymized + killed the Clerk user.
  const deleteMutation = trpc.me.deleteAccount.useMutation();
  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your Gloē account and personal info. Active vouchers and saved deals will be removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(undefined, {
              onSuccess: async () => {
                await signOut();
                router.replace('/(auth)/login');
              },
              onError: () => {
                Alert.alert(
                  "Couldn't delete account",
                  'Something went wrong. Please try again or email support@gloe.app.',
                );
              },
            });
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[5],
          paddingBottom: insets.bottom + space[10],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={8}>
          <Text variant="display-lg" tone="primary" weight="medium">
            Profile
          </Text>

          {isSignedIn ? (
            <SignedInBody user={user} onInvite={() => router.push('/(app)/referral')} />
          ) : (
            <AnonymousBody
              onSignIn={() => router.push('/(auth)/login')}
              onSignUp={() => router.push('/(auth)/signup')}
            />
          )}

          {isSignedIn && activeTicket ? (
            <ActiveCaseCard
              ticket={activeTicket}
              onPressIn={() => prefetch.supportCase(activeTicket.id)}
              onPress={() => router.push(`/(app)/support/${activeTicket.id}`)}
            />
          ) : null}

          <SettingsList
            isSignedIn={isSignedIn}
            activeClaimsCount={activeClaims.length}
            onYourDeals={() => router.push('/(app)/(tabs)/saved')}
            onAppearance={() => router.push('/(app)/settings/appearance')}
            onOpenWallet={() => router.push('/(app)/(tabs)/wallet')}
            onOpenSupport={() => router.push('/(app)/support/cases')}
          />

          {isSignedIn ? (
            <AccountActions
              onSignOut={signOut}
              onDeleteAccount={onDeleteAccount}
              deleting={deleteMutation.isPending}
            />
          ) : null}
        </Stack>
      </ScrollView>
      <StatusBarBackdrop />
    </View>
  );
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  awaiting_us: 'We’re on it',
  awaiting_customer: 'Gloē replied',
  resolved: 'Resolved',
  closed: 'Closed',
};

/**
 * Live card for the user's most-recent open concierge ticket. Surfaced on
 * Profile so support feels like an ongoing conversation, not a buried row.
 * Tapping opens the thread directly.
 */
function ActiveCaseCard({
  ticket,
  onPress,
  onPressIn,
}: {
  ticket: SupportTicketSummary;
  onPress: () => void;
  onPressIn?: () => void;
}) {
  const { color: palette } = useTheme();
  const hasUnread = ticket.unreadCount > 0;
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn}>
      <View
        style={{
          backgroundColor: palette.surface.elevated,
          borderRadius: radius.lg,
          padding: space[5],
          borderWidth: 1,
          borderColor: hasUnread ? palette.brand[300] : palette.border.subtle,
        }}
      >
        <Stack gap={3}>
          <Stack direction="row" justify="space-between" align="center">
            <Text variant="label" tone="brand" weight="semibold">
              YOUR CONCIERGE
            </Text>
            <Stack direction="row" gap={2} align="center">
              <Text variant="caption" tone="tertiary">
                {TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
              </Text>
              {hasUnread ? (
                <View
                  style={{
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: palette.brand[500],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" tone="inverse" weight="bold">
                    {ticket.unreadCount}
                  </Text>
                </View>
              ) : null}
            </Stack>
          </Stack>
          <Stack gap={1}>
            <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
              {ticket.subject}
            </Text>
            {ticket.lastMessagePreview ? (
              <Text variant="body-sm" tone="secondary" numberOfLines={2}>
                {ticket.lastMessagePreview}
              </Text>
            ) : null}
          </Stack>
          <Stack direction="row" gap={1} align="center">
            <Text variant="caption" tone="brand" weight="semibold">
              Open conversation
            </Text>
            <Icon name="chevronRight" size={14} color={palette.brand[500]} />
          </Stack>
        </Stack>
      </View>
    </Pressable>
  );
}

/**
 * Account actions, deliberately tucked at the very bottom and low-key — sign
 * out is a quiet text link, delete account is muted/destructive. We don't want
 * these in people's faces; they're "leave" actions, not features.
 */
function AccountActions({
  onSignOut,
  onDeleteAccount,
  deleting,
}: {
  onSignOut: () => void | Promise<void>;
  onDeleteAccount: () => void;
  deleting: boolean;
}) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={4} align="center" style={{ paddingTop: space[4], paddingBottom: space[2] }}>
      <Pressable onPress={onSignOut} hitSlop={12}>
        <Text variant="body-md" tone="secondary" weight="semibold">
          Sign out
        </Text>
      </Pressable>
      <Pressable onPress={onDeleteAccount} hitSlop={12} disabled={deleting}>
        <Text variant="body-sm" style={{ color: palette.semantic.error, opacity: deleting ? 0.5 : 0.7 }}>
          {deleting ? 'Deleting…' : 'Delete account'}
        </Text>
      </Pressable>
    </Stack>
  );
}

function SignedInBody({
  user,
  onInvite,
}: {
  user: ReturnType<typeof useAuth>['user'];
  onInvite: () => void;
}) {
  const { color: palette } = useTheme();
  const initials =
    (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  return (
    <Stack gap={5}>
      <View
        style={{
          backgroundColor: palette.surface.elevated,
          borderRadius: radius.lg,
          padding: space[5],
        }}
      >
        <Stack direction="row" gap={4} align="center">
          {user?.imageUrl ? (
            <CachedImage
              uri={user.imageUrl}
              style={{ width: 64, height: 64, borderRadius: 32 }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: palette.brand[100],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="display-sm" tone="brand" weight="semibold">
                {initials}
              </Text>
            </View>
          )}
          <Stack gap={1} flex={1}>
            <Text variant="body-lg" tone="primary" weight="semibold">
              {user?.firstName ?? 'Welcome back'}
            </Text>
            <Text variant="body-sm" tone="secondary" numberOfLines={1}>
              {user?.email ?? 'Signed in'}
            </Text>
          </Stack>
        </Stack>
      </View>

      <Stack gap={3}>
        <StatRow label="Redemptions this month" value="0 of 5" />
        <StatRow label="Reviews left" value="0" />
        <StatRow label="Member since" value="Today" />
      </Stack>
    </Stack>
  );
}

function AnonymousBody({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={5}>
      <View
        style={{
          backgroundColor: palette.surface.elevated,
          borderRadius: radius.lg,
          padding: space[6],
        }}
      >
        <Stack gap={4}>
          <Stack gap={2}>
            <Text variant="display-sm" tone="primary" weight="medium">
              Get the most out of Gloe
            </Text>
            <Text variant="body-md" tone="secondary">
              Sign up free to claim deals and save your favorites.
            </Text>
          </Stack>
          <Stack gap={3}>
            <Button label="Create an account" size="lg" fullWidth onPress={onSignUp} />
            <Button
              label="I already have an account"
              variant="secondary"
              size="lg"
              fullWidth
              onPress={onSignIn}
            />
          </Stack>
        </Stack>
      </View>
    </Stack>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  const { color: palette } = useTheme();
  return (
    <Stack
      direction="row"
      justify="space-between"
      align="center"
      style={{
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.md,
      }}
    >
      <Text variant="body-md" tone="secondary">
        {label}
      </Text>
      <Text variant="body-md" tone="primary" weight="semibold">
        {value}
      </Text>
    </Stack>
  );
}

function SettingsList({
  isSignedIn,
  activeClaimsCount,
  onYourDeals,
  onAppearance,
  onOpenWallet,
  onOpenSupport,
}: {
  isSignedIn: boolean;
  activeClaimsCount: number;
  onYourDeals: () => void;
  onAppearance: () => void;
  onOpenWallet: () => void;
  onOpenSupport: () => void;
}) {
  // Grouped so the list reads by intent rather than as a flat dump:
  //  • Activity — your own stuff inside the app (signed-in only).
  //  • Preferences — things you tune (Notifications/Location deep-link to iOS
  //    Settings → Gloe, the only place those permissions can be toggled).
  //  • Support & about — the footer/legal/help cluster.
  const groups: { title: string; rows: SettingsRow[] }[] = [
    ...(isSignedIn
      ? [
          {
            title: 'ACTIVITY',
            rows: [
              { label: 'Your deals', onPress: onYourDeals, badge: activeClaimsCount },
              { label: 'My receipts & vouchers', onPress: onOpenWallet },
            ] as SettingsRow[],
          },
        ]
      : []),
    {
      title: 'PREFERENCES',
      rows: [
        { label: 'Appearance', onPress: onAppearance },
        { label: 'Notifications', onPress: () => Linking.openSettings(), external: true },
        { label: 'Location settings', onPress: () => Linking.openSettings(), external: true },
      ],
    },
    {
      title: 'SUPPORT & ABOUT',
      rows: [
        // Always visible (even signed-out): the likeliest reason someone digs
        // through Profile while logged out is they're stuck and need help.
        { label: 'Concierge', onPress: onOpenSupport },
        { label: 'Contact info', onPress: () => Linking.openURL('mailto:support@gloe.app?subject=Update%20my%20contact%20info'), external: true },
        { label: 'Rate Gloē', onPress: () => Linking.openURL(APP_STORE_REVIEW_URL), external: true },
        { label: 'Terms & privacy', onPress: () => Linking.openURL('https://gloe.app/terms'), external: true },
        { label: 'About Gloē', value: `v${APP_VERSION}`, onPress: () => Linking.openURL('https://gloe.app/about'), external: true },
      ],
    },
  ];

  return (
    <Stack gap={5}>
      {groups.map((group) => (
        <SettingsGroup key={group.title} title={group.title} rows={group.rows} />
      ))}
    </Stack>
  );
}

type SettingsRow = {
  label: string;
  value?: string;
  onPress: () => void;
  external?: boolean;
  /** Optional count badge (e.g. active claims on "Your deals"). 0 hides it. */
  badge?: number;
};

function SettingsGroup({ title, rows }: { title: string; rows: SettingsRow[] }) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={2}>
      <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
        {title}
      </Text>
      <View
        style={{
          backgroundColor: palette.surface.elevated,
          borderRadius: radius.lg,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            style={{
              paddingVertical: space[4],
              paddingHorizontal: space[5],
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              borderBottomColor: palette.border.subtle,
            }}
          >
            <Text variant="body-md" tone="primary">
              {row.label}
            </Text>
            <Stack direction="row" gap={2} align="center">
              {row.value ? (
                <Text variant="body-sm" tone="tertiary">
                  {row.value}
                </Text>
              ) : null}
              {row.badge && row.badge > 0 ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: space[2],
                    borderRadius: 11,
                    backgroundColor: palette.brand[500],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="caption" tone="inverse" weight="bold">
                    {row.badge}
                  </Text>
                </View>
              ) : null}
              <Icon
                name={row.external ? 'arrowUpRight' : 'chevronRight'}
                size={18}
                color={palette.text.tertiary}
              />
            </Stack>
          </Pressable>
        ))}
      </View>
    </Stack>
  );
}
