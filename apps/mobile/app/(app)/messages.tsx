import { useAuth } from '@gloe/auth';
import { Button, Stack, Text, color, radius, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../features/icon/Icon';
import { mockThreads, type MockThread } from '../../features/messages/mockThreads';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useAuth();

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
        <Stack gap={6}>
          <Stack gap={1}>
            <Text variant="display-lg" tone="primary" weight="medium">
              Messages
            </Text>
            <Text variant="body-md" tone="secondary">
              Ask vendors anything before you book.
            </Text>
          </Stack>

          {!isSignedIn ? (
            <SignInGate onSignIn={() => router.push('/(auth)/login')} />
          ) : (
            <Stack gap={2}>
              {mockThreads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} />
              ))}
            </Stack>
          )}
        </Stack>
      </ScrollView>
    </View>
  );
}

function SignInGate({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[12] }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: color.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="tab.messages" size={44} color={color.brand[500]} strokeWidth={1.75} />
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 320 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          Sign in to message vendors
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          Chat with med spas directly — ask about availability, products, and aftercare before you
          book.
        </Text>
      </Stack>
      <View style={{ width: '100%', maxWidth: 320 }}>
        <Button label="Sign in" onPress={onSignIn} size="lg" fullWidth />
      </View>
    </Stack>
  );
}

function ThreadRow({ thread }: { thread: MockThread }) {
  return (
    <Pressable
      style={{
        flexDirection: 'row',
        gap: space[3],
        alignItems: 'center',
        backgroundColor: color.surface.elevated,
        borderRadius: radius.lg,
        padding: space[3],
      }}
    >
      <Image
        source={{ uri: thread.vendorAvatarUri }}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: color.neutral[200],
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Stack direction="row" justify="space-between" align="baseline">
          <Text
            variant="body-md"
            tone="primary"
            weight={thread.unreadCount > 0 ? 'semibold' : 'medium'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {thread.vendorName}
          </Text>
          <Text variant="caption" tone="tertiary">
            {thread.lastMessageAt}
          </Text>
        </Stack>
        <Text
          variant="body-sm"
          tone={thread.unreadCount > 0 ? 'primary' : 'secondary'}
          numberOfLines={1}
        >
          {thread.lastMessage}
        </Text>
      </View>
      {thread.unreadCount > 0 ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: space[2],
            backgroundColor: color.brand[500],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="caption" tone="inverse" weight="bold">
            {thread.unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
