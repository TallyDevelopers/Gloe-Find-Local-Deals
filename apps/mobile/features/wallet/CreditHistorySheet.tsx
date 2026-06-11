import { trpc } from '@gloe/api-client';
import { BottomSheet, BottomSheetScrollView, Stack, Text, space, useTheme } from '@gloe/ui';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { creditKindLabel, formatCredit, formatCreditDate } from './creditFormat';

interface CreditHistorySheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Bottom sheet listing every credit movement, newest first — earns read as
 * "+$20 Referral reward", spends as "−$20 Applied to a booking". Friendly
 * labels only; the raw ledger kinds stay a server concern.
 */
export function CreditHistorySheet({ open, onClose }: CreditHistorySheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const history = trpc.credits.history.useQuery(undefined, { enabled: open });

  const events = history.data ?? [];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: space[6], paddingBottom: insets.bottom + space[6] }}
      >
        <Stack gap={5}>
          <Stack gap={1}>
            <Text variant="display-sm" tone="primary" weight="medium">
              Credit history
            </Text>
            <Text variant="body-sm" tone="secondary">
              Everything you've earned and spent.
            </Text>
          </Stack>

          {history.isLoading ? (
            <View style={{ paddingVertical: space[10], alignItems: 'center' }}>
              <ActivityIndicator color={palette.brand[500]} />
            </View>
          ) : events.length === 0 ? (
            <View style={{ paddingVertical: space[8] }}>
              <Text variant="body-md" tone="secondary" align="center">
                No credit activity yet. Invite a friend to start earning.
              </Text>
            </View>
          ) : (
            <Stack gap={0}>
              {events.map((event, i) => {
                const isEarn = event.amountCents > 0;
                return (
                  <View
                    key={event.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[3],
                      paddingVertical: space[3] + 2,
                      borderBottomWidth: i === events.length - 1 ? 0 : 1,
                      borderBottomColor: palette.border.subtle,
                    }}
                  >
                    <Stack gap={1} style={{ flex: 1 }}>
                      <Text variant="body-md" tone="primary" weight="medium" numberOfLines={1}>
                        {creditKindLabel(event.kind)}
                      </Text>
                      <Text variant="body-sm" tone="tertiary" numberOfLines={2}>
                        {formatCreditDate(event.createdAt)}
                        {isEarn && event.expiresAt
                          ? ` · expires ${formatCreditDate(event.expiresAt)}`
                          : ''}
                      </Text>
                      {event.note ? (
                        <Text variant="body-sm" tone="secondary" numberOfLines={2}>
                          {event.note}
                        </Text>
                      ) : null}
                    </Stack>
                    <Text
                      variant="body-md"
                      weight="semibold"
                      style={{ color: isEarn ? palette.brand[700] : palette.text.secondary }}
                    >
                      {isEarn ? `+${formatCredit(event.amountCents)}` : formatCredit(event.amountCents)}
                    </Text>
                  </View>
                );
              })}
            </Stack>
          )}
        </Stack>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
