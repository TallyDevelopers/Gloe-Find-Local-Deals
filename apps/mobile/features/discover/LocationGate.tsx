import { Button, Stack, Text, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';
import { LocationPickerSheet } from '../discover-header/LocationPickerSheet';
import { useSelectedLocation } from '../discover-header/SelectedLocationProvider';

/**
 * Home (All) takeover shown when we don't yet have the user's location. Instead
 * of faking a city and showing irrelevant deals, the feed is replaced by a
 * single clear ask — because without a location there's genuinely nothing local
 * to browse. Granting flips `hasLocation` true and the real feed paints; if the
 * OS blocks the prompt, we fall back to the manual city picker.
 *
 * Deliberately minimal: one icon, one line, one button. No clutter — this is
 * the ONLY thing on home until a location exists.
 */
export function LocationGate() {
  const { color: palette } = useTheme();
  const { requestLocation, gpsDenied } = useSelectedLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onUseLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      const ok = await requestLocation();
      // Permission blocked (e.g. previously denied at OS level) → manual picker.
      if (!ok) setPickerOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: space[6], paddingTop: space[10], alignItems: 'center' }}>
      <Stack gap={5} align="center" style={{ maxWidth: 340 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: palette.brand[100],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="pin" size={32} color={palette.brand[600]} strokeWidth={2} />
        </View>

        <Stack gap={2} align="center">
          <Text variant="display-sm" tone="primary" weight="medium" style={{ textAlign: 'center' }}>
            See med-spa deals near you
          </Text>
          <Text variant="body-md" tone="secondary" style={{ textAlign: 'center' }}>
            Share your location and we&apos;ll surface the best treatments and prices around you.
          </Text>
        </Stack>

        <Stack gap={3} style={{ width: '100%' }}>
          <Button
            label={gpsDenied ? 'Choose a location' : 'Use my location'}
            variant="primary"
            size="lg"
            fullWidth
            loading={busy}
            onPress={gpsDenied ? () => setPickerOpen(true) : onUseLocation}
          />
          {/* Always offer the manual path — travel-for-treatment, planning a
              trip, or a blocked OS permission. */}
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Text variant="body-md" tone="link" weight="semibold">
              Or choose a city
            </Text>
          </Pressable>
        </Stack>

        {gpsDenied ? (
          <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
            Location is off for Gloē. Enable it in Settings, or pick a city above.
          </Text>
        ) : null}
      </Stack>

      <LocationPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </View>
  );
}
