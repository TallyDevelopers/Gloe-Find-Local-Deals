import { Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '../icon/Icon';
import { LocationPickerSheet } from './LocationPickerSheet';
import { useSelectedLocation } from './SelectedLocationProvider';

/**
 * Location pill showing the city you're browsing, sat between the search bar and
 * the map button on the home header. Once a location is active this is both the
 * "where am I searching?" answer (the city name, not just an icon) and the
 * "change it" affordance — tapping opens the picker, so moving your location
 * never detours through Map/Search.
 *
 * Styled as a neutral secondary-surface pill (not brand) so the brand-blue
 * MapButton stays the primary action; height matches MapButton (48) so the
 * three controls read as one row. The city name is truncated (and the state
 * suffix stripped) to stay narrow next to a full-width search bar — the wide
 * chevron'd LocationPill was rejected for crowding search.
 */
export function LocationPinButton() {
  const { location } = useSelectedLocation();
  const { color: palette } = useTheme();
  const [open, setOpen] = useState(false);

  // Strip the state suffix for a tighter pill ("San Diego, CA" → "San Diego").
  const display = location.label.split(',')[0] ?? location.label;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Browsing ${location.label}. Tap to change location.`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
          height: 48,
          maxWidth: 140,
          paddingHorizontal: space[3],
          borderRadius: radius.md,
          backgroundColor: palette.surface.secondary,
          ...shadow.sm,
        }}
      >
        <Icon name="pin" size={18} color={palette.text.primary} strokeWidth={2.25} />
        <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
          {display}
        </Text>
      </Pressable>

      <LocationPickerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
