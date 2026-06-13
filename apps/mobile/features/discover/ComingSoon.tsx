import { trpc } from '@gloe/api-client';
import { Button, Input, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';
import { LocationPickerSheet } from '../discover-header/LocationPickerSheet';

interface ComingSoonProps {
  /** The user's resolved area label, e.g. "Near you" or a picked city. */
  cityLabel: string;
  /** Resolved GPS coords, stored with the waitlist signup so we can map demand. */
  lat?: number;
  lng?: number;
  /** Let the user bail into the SoCal feed instead of waiting. */
  onBrowseAnyway: () => void;
}

/**
 * Shown on Discover when a user is outside the current launch area (the deals
 * feed came back empty for their real location). Frames it as momentum — "we're
 * growing, you're early" — lists the cities that are ACTUALLY live (pulled from
 * data, so it's never stale), and captures an email so we can see demand by city
 * and notify them when we arrive. No notification fires yet; this is collection.
 */
export function ComingSoon({ cityLabel, lat, lng, onBrowseAnyway }: ComingSoonProps) {
  const { color: palette } = useTheme();
  const liveCities = trpc.waitlist.liveCities.useQuery();
  const join = trpc.waitlist.join.useMutation();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const cities = liveCities.data ?? [];
  const liveCitiesText =
    cities.length > 0 ? cities.map((c) => c.city).join(' · ') : 'Southern California';

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function onSubmit() {
    if (!emailValid || join.isPending) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await join.mutateAsync({
        email: email.trim(),
        cityLabel,
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {}),
      });
      setSubmitted(true);
    } catch {
      // Surface a soft inline error; the mutation error state drives the message.
    }
  }

  return (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[8] }}>
      <Stack gap={5} align="center">
        <Text variant="display-sm" tone="primary" style={{ textAlign: 'center' }}>
          ✨ Gloē is growing
        </Text>

        <Text variant="body-lg" tone="secondary" style={{ textAlign: 'center' }}>
          We&apos;re not in {cityLabel === 'Near you' ? 'your area' : cityLabel} just yet — but
          we&apos;re expanding fast.
        </Text>

        {/* Dynamic "now live in" — always accurate, auto-updates as you launch cities.
            Warm champagne brand surface so it reads on-brand, not a cold white block. */}
        <View
          style={{
            backgroundColor: palette.brand[100],
            borderColor: palette.brand[200],
            borderWidth: 1,
            borderRadius: 16,
            paddingVertical: space[4],
            paddingHorizontal: space[5],
            width: '100%',
          }}
        >
          <Text
            variant="label"
            style={{ textAlign: 'center', color: palette.brand[700], letterSpacing: 1 }}
          >
            NOW LIVE IN
          </Text>
          <Text
            variant="body-md"
            weight="semibold"
            style={{ textAlign: 'center', marginTop: space[1], color: palette.brand[800] }}
          >
            {liveCitiesText}
          </Text>
          <Text
            variant="caption"
            style={{ textAlign: 'center', marginTop: space[1], color: palette.brand[600] }}
          >
            New cities every week.
          </Text>
        </View>

        {/* Take a look around a live area. Out-of-area users can enter an address
            or pick a popular city to see how Gloē works before we reach them —
            picking a live city flips the feed and this screen falls away. */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPickerOpen(true);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            paddingVertical: space[4],
            paddingHorizontal: space[5],
            borderColor: palette.border.default,
            borderWidth: 1,
            borderRadius: radius.lg,
            width: '100%',
          }}
        >
          <Icon name="search" size={18} color={palette.brand[600]} strokeWidth={2.25} />
          <Stack gap={0} style={{ flex: 1 }}>
            <Text variant="body-md" tone="primary" weight="semibold">
              Explore a live city
            </Text>
            <Text variant="caption" tone="secondary">
              Enter an address or pick a city to see how it works.
            </Text>
          </Stack>
          <Icon name="chevronRight" size={18} color={palette.text.tertiary} strokeWidth={2} />
        </Pressable>

        {submitted ? (
          <Stack gap={2} align="center" style={{ paddingVertical: space[3] }}>
            <Text variant="body-lg" tone="primary" weight="semibold" style={{ textAlign: 'center' }}>
              You&apos;re on the list 🎉
            </Text>
            <Text variant="body-md" tone="secondary" style={{ textAlign: 'center' }}>
              We&apos;ll reach out the moment Gloē lands near you.
            </Text>
          </Stack>
        ) : (
          <Stack gap={3} style={{ width: '100%' }}>
            <Text variant="body-md" tone="secondary" style={{ textAlign: 'center' }}>
              Want in when we reach you? Drop your email.
            </Text>
            <Input
              placeholder="you@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {join.isError ? (
              <Text variant="caption" tone="error" style={{ textAlign: 'center' }}>
                {join.error.message || 'Something went wrong — try again.'}
              </Text>
            ) : null}
            <Button
              label="Notify me"
              variant="primary"
              fullWidth
              loading={join.isPending}
              disabled={!emailValid}
              onPress={onSubmit}
            />
          </Stack>
        )}

        <Button label="Browse SoCal deals" variant="ghost" fullWidth onPress={onBrowseAnyway} />
      </Stack>

      <LocationPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </View>
  );
}
