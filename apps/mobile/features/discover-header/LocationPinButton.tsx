import { radius, shadow, useTheme } from '@gloe/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '../icon/Icon';
import { LocationPickerSheet } from './LocationPickerSheet';
import { useSelectedLocation } from './SelectedLocationProvider';

/**
 * Square location-pin button, sits between the search bar and the map button on
 * the home header. The quiet companion to MapButton: once a location is active
 * this is the persistent "current location + change it" affordance (GLO-26 AC),
 * without crowding the search bar with a wide city pill.
 *
 * Styled as a neutral secondary-surface square (not brand) so the brand-blue
 * MapButton stays the primary action. Sized to match MapButton (48×48) so the
 * three controls read as one row. Tap opens the same LocationPickerSheet the
 * gate and pill use, so changing location never detours through Map/Search.
 */
export function LocationPinButton() {
  const { location } = useSelectedLocation();
  const { color: palette } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Change location (currently ${location.label})`}
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.md,
          backgroundColor: palette.surface.secondary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.sm,
        }}
      >
        <Icon name="pin" size={22} color={palette.text.primary} strokeWidth={2} />
      </Pressable>

      <LocationPickerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
