import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, color, radius, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaimedDeals } from '../../features/claimed/ClaimedDealsProvider';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const { activeClaims } = useClaimedDeals();

  const isSignedIn = status === 'signed-in';

  return (
    <View style={{ flex: 1, backgroundColor: color.surface.primary }}>
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

          {isSignedIn ? <SignedInBody user={user} onSignOut={signOut} /> : (
            <AnonymousBody
              onSignIn={() => router.push('/(auth)/login')}
              onSignUp={() => router.push('/(auth)/signup')}
            />
          )}

          {isSignedIn ? (
            <Stack gap={2}>
              <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
                ACTIVITY
              </Text>
              <View
                style={{
                  backgroundColor: color.surface.elevated,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                }}
              >
                <Pressable
                  onPress={() => router.push('/(app)/saved')}
                  style={{
                    paddingVertical: space[4],
                    paddingHorizontal: space[5],
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text variant="body-md" tone="primary">
                    Your deals
                  </Text>
                  <Stack direction="row" gap={2} align="center">
                    {activeClaims.length > 0 ? (
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          paddingHorizontal: space[2],
                          borderRadius: 11,
                          backgroundColor: color.brand[500],
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text variant="caption" tone="inverse" weight="bold">
                          {activeClaims.length}
                        </Text>
                      </View>
                    ) : null}
                    <Text variant="body-md" tone="tertiary">
                      ›
                    </Text>
                  </Stack>
                </Pressable>
              </View>
            </Stack>
          ) : null}

          <SettingsList />
        </Stack>
      </ScrollView>
    </View>
  );
}

function SignedInBody({
  user,
  onSignOut,
}: {
  user: ReturnType<typeof useAuth>['user'];
  onSignOut: () => void | Promise<void>;
}) {
  const initials =
    (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  return (
    <Stack gap={5}>
      <View
        style={{
          backgroundColor: color.surface.elevated,
          borderRadius: radius.lg,
          padding: space[5],
        }}
      >
        <Stack direction="row" gap={4} align="center">
          {user?.imageUrl ? (
            <Image
              source={{ uri: user.imageUrl }}
              style={{ width: 64, height: 64, borderRadius: 32 }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: color.brand[100],
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

      <Button label="Sign out" variant="secondary" size="lg" fullWidth onPress={onSignOut} />
    </Stack>
  );
}

function AnonymousBody({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <Stack gap={5}>
      <View
        style={{
          backgroundColor: color.surface.elevated,
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
              Sign up free to claim deals, save your favorites, and chat with vendors.
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
  return (
    <Stack
      direction="row"
      justify="space-between"
      align="center"
      style={{
        paddingVertical: space[3],
        paddingHorizontal: space[4],
        backgroundColor: color.surface.elevated,
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

function SettingsList() {
  const rows: { label: string; onPress?: () => void }[] = [
    { label: 'Notifications' },
    { label: 'Location settings' },
    { label: 'Help & support' },
    { label: 'Terms & privacy' },
    { label: 'About Gloe' },
  ];

  return (
    <Stack gap={2}>
      <Text variant="label" tone="tertiary" style={{ paddingHorizontal: space[2] }}>
        SETTINGS
      </Text>
      <View
        style={{
          backgroundColor: color.surface.elevated,
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
              borderBottomColor: color.border.subtle,
            }}
          >
            <Text variant="body-md" tone="primary">
              {row.label}
            </Text>
            <Text variant="body-md" tone="tertiary">
              ›
            </Text>
          </Pressable>
        ))}
      </View>
    </Stack>
  );
}
