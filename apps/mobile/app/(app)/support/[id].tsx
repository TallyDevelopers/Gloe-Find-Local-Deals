import { trpc, type RouterOutputs } from '@gloe/api-client';
import { Input, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CachedImage } from '../../../features/image/CachedImage';
import { AttachmentSheet } from '../../../features/support/AttachmentSheet';
import { MessageAttachments } from '../../../features/support/MessageAttachments';
import { useSupportUpload } from '../../../features/support/useSupportUpload';
import { useSupport } from '../../../features/support/SupportProvider';

/**
 * Support chat thread — the customer-facing half of a help ticket.
 *
 * This is a 1:1 conversation between the customer and the Gloe team (an agent,
 * or an automated system note). It reads like Messages: customer bubbles hug
 * the right in warm brand[100]; the team's replies sit left on a clean elevated
 * surface; system notes ("Ticket reopened", "Resolved") run quietly down the
 * middle as muted captions.
 *
 * Two behaviors make this feel cared-for rather than transactional:
 *   1. We mark the team's messages read the moment the screen is focused, so
 *      the unread badge clears the instant you actually look.
 *   2. Above the composer we tell the truth about notifications: if you've
 *      granted them, you can leave — we'll ping you the second we reply. If you
 *      haven't, we say so plainly and offer a one-tap jump to Settings, rather
 *      than leaving you to wonder whether checking back is on you.
 *
 * When a ticket is resolved or closed the thread stays fully readable but the
 * composer locks, replaced by a status chip — closing the loop without losing
 * the history.
 */
export default function SupportThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const { notifPermission } = useSupport();
  const utils = trpc.useUtils();
  const scrollRef = useRef<ScrollView>(null);

  const [draft, setDraft] = useState('');
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const upload = useSupportUpload();

  const caseQuery = trpc.support.getCase.useQuery(
    { id: id ?? '' },
    { enabled: !!id },
  );

  const markRead = trpc.support.markRead.useMutation({
    onSuccess: () => {
      // The badge count lives in a sibling query; refresh it so the dot clears
      // app-wide the moment we read here.
      void utils.support.unreadCount.invalidate();
    },
  });

  // Mark the team's messages read on every focus (not just mount): coming back
  // to this thread after a reply landed should clear the badge again.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      markRead.mutate({ ticketId: id });
      // markRead is a stable tRPC mutation; intentionally not in deps to avoid
      // re-firing on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const reply = trpc.support.reply.useMutation({
    onMutate: async ({ body }) => {
      if (!id) return;
      await utils.support.getCase.cancel({ id });
      const previous = utils.support.getCase.getData({ id });
      const optimistic: ThreadMessage = {
        id: `${OPTIMISTIC_PREFIX}${Date.now()}`,
        ticketId: id,
        senderType: 'customer',
        senderUserId: null,
        body,
        readAt: null,
        createdAt: new Date().toISOString(),
        attachments: [],
      };
      utils.support.getCase.setData({ id }, (old) =>
        old
          ? {
              ...old,
              // A customer reply reopens a resolved/closed ticket — reflect that
              // optimistically so the composer doesn't flicker back to a chip.
              ticket: {
                ...old.ticket,
                status:
                  old.ticket.status === 'resolved' || old.ticket.status === 'closed'
                    ? 'awaiting_us'
                    : old.ticket.status,
              },
              messages: [...old.messages, optimistic],
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (id && ctx?.previous) utils.support.getCase.setData({ id }, ctx.previous);
    },
    onSettled: () => {
      if (id) void utils.support.getCase.invalidate({ id });
    },
  });

  const data = caseQuery.data;
  const ticket = data?.ticket;
  const messages = data?.messages ?? [];
  const status = ticket?.status;
  const isLocked = status === 'resolved' || status === 'closed';

  // Keep the latest message in view as the thread grows / a reply lands.
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const trimmed = draft.trim();
  const doneAttachments = upload.attachments.filter((a) => a.status === 'done');
  // Can send with text OR attachments. Block while any upload is still in flight.
  const canSend =
    (trimmed.length > 0 || doneAttachments.length > 0) &&
    !upload.isUploading &&
    !reply.isPending &&
    !!id &&
    !isLocked;

  const onSend = () => {
    if (!canSend || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reply.mutate({
      ticketId: id,
      body: trimmed,
      attachments: doneAttachments.map((a) => ({
        kind: a.kind,
        url: a.url,
        ...(a.thumbnailUrl ? { thumbnailUrl: a.thumbnailUrl } : {}),
        width: a.width,
        height: a.height,
      })),
    });
    setDraft('');
    upload.clear();
  };

  if (!id) {
    return (
      <NotFound onBack={() => router.back()} message="No ticket selected" />
    );
  }

  if (caseQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={palette.brand[500]} />
      </View>
    );
  }

  if (caseQuery.isError || !ticket) {
    return (
      <NotFound onBack={() => router.back()} message="We couldn’t open this conversation" />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.surface.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header: back + subject + (when locked) a status chip */}
      <View
        style={{
          paddingTop: insets.top + space[2],
          paddingBottom: space[3],
          paddingHorizontal: space[5],
          backgroundColor: palette.surface.primary,
          borderBottomWidth: 1,
          borderBottomColor: palette.border.subtle,
        }}
      >
        <Stack direction="row" align="center" gap={3}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text variant="body-md" tone="secondary" weight="medium">
              ←
            </Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1}>
              {ticket.subject}
            </Text>
            <Text variant="caption" tone="tertiary">
              {statusLabel(status)}
            </Text>
          </View>
          {isLocked ? <StatusChip status={status} /> : null}
        </Stack>
      </View>

      {/* The thread */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: space[4],
          paddingBottom: space[4],
          gap: space[3],
        }}
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} palette={palette} />
        ))}
      </ScrollView>

      {/* Permission-aware caption strip — sits directly above the composer */}
      <NotifStrip granted={notifPermission === 'granted'} palette={palette} />

      {/* Composer (or a "this conversation is closed" chip when locked) */}
      {isLocked ? (
        <View
          style={{
            paddingHorizontal: space[5],
            paddingTop: space[3],
            paddingBottom: insets.bottom + space[3],
            backgroundColor: palette.surface.primary,
            borderTopWidth: 1,
            borderTopColor: palette.border.subtle,
            alignItems: 'center',
          }}
        >
          <Stack direction="row" align="center" gap={2}>
            <StatusChip status={status} />
            <Text variant="body-sm" tone="tertiary">
              {status === 'resolved'
                ? 'This conversation is resolved.'
                : 'This conversation is closed.'}
            </Text>
          </Stack>
          <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: space[1] }}>
            Need more help? Start a new request from the Help center.
          </Text>
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: space[4],
            paddingTop: space[3],
            paddingBottom: insets.bottom + space[3],
            backgroundColor: palette.surface.primary,
            borderTopWidth: 1,
            borderTopColor: palette.border.subtle,
          }}
        >
          {/* Pending-attachment preview strip (thumbnails + progress + remove) */}
          {upload.attachments.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[2] }}>
              {upload.attachments.map((a) => (
                <View key={a.localUri} style={{ position: 'relative' }}>
                  <CachedImage
                    uri={a.thumbnailUrl ?? a.localUri}
                    style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: palette.neutral[200] }}
                  />
                  {a.status !== 'done' ? (
                    <View
                      style={{
                        position: 'absolute', inset: 0, borderRadius: radius.md,
                        backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => upload.removeAttachment(a.localUri)}
                    hitSlop={8}
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
                      backgroundColor: palette.text.primary, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text variant="caption" tone="inverse" weight="bold">×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Stack direction="row" align="flex-end" gap={2}>
            <Pressable
              onPress={() => setAttachSheetOpen(true)}
              disabled={reply.isPending}
              hitSlop={6}
              style={{
                width: 40, height: 48, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text variant="display-sm" tone="secondary">＋</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Input
                value={draft}
                onChangeText={setDraft}
                onFocus={() => {
                  // When the keyboard rises, keep the latest message + composer
                  // in view so the user always sees what they're replying to.
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
                }}
                placeholder="Write a reply…"
                multiline
                returnKeyType="default"
                editable={!reply.isPending}
                containerStyle={{ flex: 1 }}
              />
            </View>
            <Pressable
              onPress={onSend}
              disabled={!canSend}
              hitSlop={6}
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.pill,
                backgroundColor: canSend ? palette.brand[500] : palette.surface.secondary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canSend ? 1 : 0.6,
              }}
            >
              {reply.isPending ? (
                <ActivityIndicator color={palette.text.inverse} size="small" />
              ) : (
                <Text
                  style={{
                    color: canSend ? palette.text.inverse : palette.text.tertiary,
                    fontSize: 20,
                    lineHeight: 22,
                    marginTop: -1,
                  }}
                >
                  ↑
                </Text>
              )}
            </Pressable>
          </Stack>
        </View>
      )}

      <AttachmentSheet
        open={attachSheetOpen}
        onClose={() => setAttachSheetOpen(false)}
        onTakePhoto={() => void upload.takePhoto()}
        onChooseLibrary={() => void upload.pickAndUpload()}
      />
    </KeyboardAvoidingView>
  );
}

/* ─────────────── types ─────────────── */

/**
 * The thread message shape, taken verbatim from the support.getCase output so
 * it tracks the server's SupportMessage exactly (id, ticketId, senderType,
 * senderUserId, body, readAt, createdAt). Optimistic sends reuse this same
 * shape; we tag them with an `optimistic-` id prefix and dim them in render
 * until the server confirms, rather than carrying an extra client-only field
 * the cache type wouldn't accept.
 */
type GetCaseOutput = RouterOutputs['support']['getCase'];
type ThreadMessage = GetCaseOutput['messages'][number];

const OPTIMISTIC_PREFIX = 'optimistic-';

type Palette = ReturnType<typeof useTheme>['color'];
type TicketStatus = GetCaseOutput['ticket']['status'];

/* ─────────────── sub-components ─────────────── */

function MessageRow({ message, palette }: { message: ThreadMessage; palette: Palette }) {
  // System notes are centered, muted captions — neither side's voice.
  if (message.senderType === 'system') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: space[1] }}>
        <Text variant="caption" tone="tertiary" align="center" style={{ maxWidth: '85%' }}>
          {message.body}
        </Text>
      </View>
    );
  }

  const isCustomer = message.senderType === 'customer';
  const pending = message.id.startsWith(OPTIMISTIC_PREFIX);

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isCustomer ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={{
          maxWidth: '82%',
          backgroundColor: isCustomer ? palette.brand[100] : palette.surface.elevated,
          borderRadius: radius.xl,
          borderBottomRightRadius: isCustomer ? radius.sm : radius.xl,
          borderBottomLeftRadius: isCustomer ? radius.xl : radius.sm,
          borderWidth: isCustomer ? 0 : 1,
          borderColor: palette.border.subtle,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
          opacity: pending ? 0.6 : 1,
        }}
      >
        {!isCustomer ? (
          <Text
            variant="caption"
            tone="brand"
            weight="semibold"
            style={{ marginBottom: 2, letterSpacing: 0.3 }}
          >
            Gloe team
          </Text>
        ) : null}
        {message.body ? (
          <Text variant="body-md" tone="primary">
            {message.body}
          </Text>
        ) : null}
        {message.attachments && message.attachments.length > 0 ? (
          <MessageAttachments attachments={message.attachments} />
        ) : null}
        <Text
          variant="caption"
          tone="tertiary"
          align={isCustomer ? 'right' : 'left'}
          style={{ marginTop: 4, fontSize: 11 }}
        >
          {pending ? 'Sending…' : formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

/**
 * The honest, permission-aware strip above the composer. We don't nag — we just
 * tell you what to expect given the state you're actually in, and (when off)
 * make turning it on a single tap away.
 */
function NotifStrip({ granted, palette }: { granted: boolean; palette: Palette }) {
  return (
    <View
      style={{
        paddingHorizontal: space[5],
        paddingVertical: space[3],
        backgroundColor: palette.surface.secondary,
      }}
    >
      {granted ? (
        <Text variant="caption" tone="secondary" align="center">
          You can close the app — we’ll send you a notification the moment we reply.
        </Text>
      ) : (
        <Text variant="caption" tone="secondary" align="center">
          Turn on notifications to get pinged when we reply — otherwise check back here.{' '}
          <Text
            variant="caption"
            tone="brand"
            weight="semibold"
            onPress={() => {
              void Linking.openSettings();
            }}
            suppressHighlighting
          >
            Turn on notifications
          </Text>
        </Text>
      )}
    </View>
  );
}

function StatusChip({ status }: { status: TicketStatus | undefined }) {
  const { color: palette } = useTheme();
  const resolved = status === 'resolved';
  const bg = resolved ? palette.semantic.success : palette.surface.secondary;
  const fg = resolved ? palette.text.inverse : palette.text.tertiary;
  return (
    <View
      style={{
        paddingHorizontal: space[3],
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      <Text variant="caption" weight="semibold" style={{ color: fg, fontSize: 11, letterSpacing: 0.6 }}>
        {resolved ? 'Resolved' : 'Closed'}
      </Text>
    </View>
  );
}

function NotFound({ onBack, message }: { onBack: () => void; message: string }) {
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface.primary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space[6],
      }}
    >
      <Stack gap={3} align="center">
        <Text variant="display-sm" tone="primary" align="center">
          {message}
        </Text>
        <Pressable onPress={onBack} style={{ paddingVertical: space[3] }} hitSlop={8}>
          <Text variant="body-md" tone="link" weight="semibold">
            Go back
          </Text>
        </Pressable>
      </Stack>
    </View>
  );
}

/* ─────────────── helpers ─────────────── */

function statusLabel(status: TicketStatus | undefined): string {
  switch (status) {
    case 'awaiting_us':
      return 'We’re on it';
    case 'awaiting_customer':
      return 'Awaiting your reply';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    case 'open':
    default:
      return 'Open';
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}
