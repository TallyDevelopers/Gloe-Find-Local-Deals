import { trpc } from '@gloe/api-client';
import { Button, Input, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusBarBackdrop } from '../../../features/layout/StatusBarBackdrop';
import { useSupport, type SupportTicketSummary } from '../../../features/support/SupportProvider';

const SUPPORT_EMAIL = 'support@gloe.app';

// Categories mirror the DB CHECK constraint on support_tickets.category.
const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'refund', label: 'Refund' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'other', label: 'Other' },
];

type TicketCategory = 'refund' | 'voucher' | 'payment' | 'account' | 'vendor' | 'other';
type TicketStatus = 'open' | 'awaiting_us' | 'awaiting_customer' | 'resolved' | 'closed';

// Human-readable status badge copy + tone. We collapse the 5-state machine into
// what a customer cares about: are *they* on the hook, are *we*, or is it done.
const STATUS_META: Record<TicketStatus, { label: string; tone: 'open' | 'wait' | 'done' }> = {
  open: { label: 'Open', tone: 'open' },
  awaiting_us: { label: 'We’re on it', tone: 'open' },
  awaiting_customer: { label: 'Your reply needed', tone: 'wait' },
  resolved: { label: 'Resolved', tone: 'done' },
  closed: { label: 'Closed', tone: 'done' },
};

export default function SupportCasesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { color: palette } = useTheme();
  const { tickets, isLoading, refetch } = useSupport();
  const scrollRef = useRef<ScrollView>(null);

  const [composing, setComposing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const createMutation = trpc.support.create.useMutation();

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const hasTickets = tickets.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface.primary }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingTop: insets.top + space[4],
            paddingHorizontal: space[5],
            paddingBottom: insets.bottom + space[10],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // The OS shifts the scroll content up as the keyboard rises so the
          // focused field stays visible — the user never has to scroll to see
          // what they're typing. Modern replacement for KeyboardAvoidingView.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand[500]}
            />
          }
        >
          <Stack gap={6}>
            <Stack gap={3}>
              {/* Explicit way out — the sheet also swipes down, but a visible
                  control matters when the keyboard or content is in the way. */}
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                style={{ alignSelf: 'flex-start' }}
              >
                <Text variant="body-md" tone="brand" weight="semibold">
                  ‹ Back
                </Text>
              </Pressable>
              <Stack gap={1}>
                <Text variant="display-lg" tone="primary" weight="medium">
                  Concierge
                </Text>
                {!composing ? (
                  <Text variant="body-md" tone="secondary">
                    {hasTickets
                      ? 'Your conversations with the Gloē team.'
                      : 'Questions about a deal, voucher, or your account? We’re here.'}
                  </Text>
                ) : null}
              </Stack>
            </Stack>

            {composing ? (
              <ComposeForm
                submitting={createMutation.isPending}
                error={createMutation.isError}
                onFocusBody={() => {
                  // Belt-and-suspenders for the tall body box: nudge the scroll
                  // so the field clears the keyboard even on smaller screens.
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
                }}
                onCancel={() => {
                  createMutation.reset();
                  setComposing(false);
                }}
                onSubmit={(subject, category, body, claimId) => {
                  createMutation.mutate(
                    { subject, category, body, ...(claimId ? { claimId } : {}) },
                    {
                      onSuccess: (created) => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setComposing(false);
                        createMutation.reset();
                        router.replace(`/(app)/support/${created.id}`);
                      },
                    },
                  );
                }}
              />
            ) : hasTickets ? (
              <Stack gap={4}>
                <Stack gap={3}>
                  {tickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onPress={() => router.push(`/(app)/support/${ticket.id}`)}
                    />
                  ))}
                </Stack>
                <Button
                  label="New request"
                  size="lg"
                  fullWidth
                  onPress={() => setComposing(true)}
                />
                <EmailFallback />
              </Stack>
            ) : (
              <EmptyState
                loading={isLoading}
                onNewRequest={() => setComposing(true)}
              />
            )}
          </Stack>
        </ScrollView>
      <StatusBarBackdrop />
    </View>
  );
}

function TicketCard({
  ticket,
  onPress,
}: {
  ticket: SupportTicketSummary;
  onPress: () => void;
}) {
  const { color: palette } = useTheme();
  const meta = STATUS_META[ticket.status as TicketStatus] ?? STATUS_META.open;
  const hasUnread = ticket.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.lg,
        padding: space[4],
        gap: space[2],
      }}
    >
      <Stack direction="row" gap={3} align="center" justify="space-between">
        <Stack direction="row" gap={2} align="center" flex={1}>
          {hasUnread ? (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: palette.brand[500],
              }}
            />
          ) : null}
          <Text
            variant="body-md"
            tone="primary"
            weight={hasUnread ? 'semibold' : 'medium'}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {ticket.subject}
          </Text>
        </Stack>
        <StatusBadge label={meta.label} tone={meta.tone} />
      </Stack>

      {ticket.lastMessagePreview ? (
        <Text variant="body-sm" tone="secondary" numberOfLines={2}>
          {ticket.lastMessagePreview}
        </Text>
      ) : null}

      <Stack direction="row" gap={2} align="center" justify="space-between">
        <Text variant="caption" tone="tertiary">
          {ticket.lastMessageAt ? formatRelative(ticket.lastMessageAt) : 'Just now'}
        </Text>
        <Text variant="caption" tone="tertiary">
          ›
        </Text>
      </Stack>
    </Pressable>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'open' | 'wait' | 'done' }) {
  const { color: palette } = useTheme();
  const bg =
    tone === 'done'
      ? palette.surface.secondary
      : tone === 'wait'
        ? palette.accent[100]
        : palette.brand[100];
  const fg =
    tone === 'done'
      ? palette.text.tertiary
      : tone === 'wait'
        ? palette.accent[700]
        : palette.brand[700];
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: space[3],
        paddingVertical: space[1],
      }}
    >
      <Text variant="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

function ComposeForm({
  submitting,
  error,
  onCancel,
  onSubmit,
  onFocusBody,
}: {
  submitting: boolean;
  error: boolean;
  onCancel: () => void;
  onSubmit: (subject: string, category: TicketCategory | undefined, body: string, claimId: string | undefined) => void;
  onFocusBody: () => void;
}) {
  const { color: palette } = useTheme();
  const { notifPermission } = useSupport();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory | undefined>(undefined);
  const [body, setBody] = useState('');
  const [claimId, setClaimId] = useState<string | undefined>(undefined);
  const [orderSearch, setOrderSearch] = useState('');
  const ordersQuery = trpc.support.myOrders.useQuery(
    orderSearch.trim().length >= 2 ? { search: orderSearch.trim() } : undefined,
  );
  const orders = ordersQuery.data ?? [];

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  const canSubmit = trimmedSubject.length > 0 && trimmedBody.length > 0 && !submitting;

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Text variant="display-sm" tone="primary" weight="medium">
          New request
        </Text>
        <Text variant="body-sm" tone="secondary">
          {notifPermission === 'granted'
            ? 'Send your message and you can close the app — we’ll send a push notification the moment we reply.'
            : 'Send your message and we’ll reply right here. Turn on notifications to get pinged when we do — otherwise just check back.'}
        </Text>
      </Stack>

      <Input
        label="Subject"
        placeholder="e.g. Refund for my facial booking"
        value={subject}
        onChangeText={setSubject}
        returnKeyType="next"
        maxLength={140}
      />

      <Stack gap={2}>
        <Text variant="label" tone="secondary">
          Category (optional)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {CATEGORIES.map((c) => {
            const selected = category === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setCategory(selected ? undefined : c.value)}
                style={{
                  paddingHorizontal: space[4],
                  paddingVertical: space[2],
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: selected ? palette.brand[500] : palette.border.default,
                  backgroundColor: selected ? palette.brand[100] : palette.surface.elevated,
                }}
              >
                <Text
                  variant="body-sm"
                  weight={selected ? 'semibold' : 'regular'}
                  style={{ color: selected ? palette.brand[700] : palette.text.secondary }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Stack>

      {orders.length > 0 || orderSearch.length > 0 ? (
        <Stack gap={2}>
          <Text variant="label" tone="secondary">
            Which order is this about? (optional)
          </Text>
          {/* Search appears once the list is long enough to need it. */}
          {orders.length > 6 || orderSearch.length > 0 ? (
            <Input
              placeholder="Search your orders…"
              value={orderSearch}
              onChangeText={setOrderSearch}
              autoCapitalize="none"
            />
          ) : null}
          <Stack gap={2}>
            {orders.map((o) => {
              const selected = claimId === o.claimId;
              return (
                <Pressable
                  key={o.claimId}
                  onPress={() => setClaimId(selected ? undefined : o.claimId)}
                  style={{
                    paddingHorizontal: space[4],
                    paddingVertical: space[3],
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? palette.brand[500] : palette.border.default,
                    backgroundColor: selected ? palette.brand[100] : palette.surface.elevated,
                  }}
                >
                  <Text
                    variant="body-md"
                    weight={selected ? 'semibold' : 'regular'}
                    numberOfLines={1}
                    style={{ color: selected ? palette.brand[800] : palette.text.primary }}
                  >
                    {o.dealTitle}
                  </Text>
                  <Text
                    variant="caption"
                    tone={selected ? undefined : 'tertiary'}
                    numberOfLines={1}
                    style={selected ? { color: palette.brand[600] } : undefined}
                  >
                    {o.vendorName} · {o.claimStatus}
                    {o.redeemedAt ? ' · redeemed' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </Stack>
        </Stack>
      ) : null}

      <Stack gap={2}>
        <Text variant="label" tone="secondary">
          How can we help?
        </Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          onFocus={onFocusBody}
          placeholder="Share the details — order, dates, what went wrong…"
          placeholderTextColor={palette.text.tertiary}
          multiline
          textAlignVertical="top"
          style={{
            minHeight: 140,
            backgroundColor: palette.surface.elevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: palette.border.default,
            padding: space[4],
            fontSize: 16,
            lineHeight: 22,
            color: palette.text.primary,
          }}
        />
      </Stack>

      {error ? (
        <Text variant="body-sm" tone="error">
          Something went wrong sending that. Please try again or email us.
        </Text>
      ) : null}

      <Stack gap={3}>
        <Button
          label="Send request"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={() => onSubmit(trimmedSubject, category, trimmedBody, claimId)}
        />
        <Button
          label="Cancel"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={submitting}
          onPress={onCancel}
        />
      </Stack>
    </Stack>
  );
}

function EmptyState({
  loading,
  onNewRequest,
}: {
  loading: boolean;
  onNewRequest: () => void;
}) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={6} align="center" style={{ paddingVertical: space[10] }}>
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
        <Text style={{ fontSize: 44, color: palette.brand[500] }}>✦</Text>
      </View>
      <Stack gap={2} align="center" style={{ maxWidth: 300 }}>
        <Text variant="display-sm" tone="primary" weight="medium" align="center">
          {loading ? 'Loading…' : 'No requests yet'}
        </Text>
        <Text variant="body-md" tone="secondary" align="center">
          Have a question about a deal, voucher, payment, or your account? Start a
          request and a real person on the Gloē team will help.
        </Text>
      </Stack>
      <Stack gap={4} style={{ width: '100%', maxWidth: 320 }}>
        <Button label="New request" onPress={onNewRequest} size="lg" fullWidth />
        <EmailFallback align="center" />
      </Stack>
    </Stack>
  );
}

function EmailFallback({ align = 'left' }: { align?: 'left' | 'center' }) {
  return (
    <Pressable
      onPress={() =>
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Gloē support')}`)
      }
      style={{ paddingVertical: space[2], alignItems: align === 'center' ? 'center' : 'flex-start' }}
    >
      <Text variant="body-sm" tone="link" weight="medium">
        Email us instead
      </Text>
    </Pressable>
  );
}

/**
 * Compact relative time ("2m", "3h", "Yesterday", "Apr 12") for the card meta
 * row. Accepts an ISO string or Date; tolerant of bad input so a malformed
 * timestamp never crashes the list.
 */
function formatRelative(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
