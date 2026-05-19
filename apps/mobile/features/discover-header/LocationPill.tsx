import { Stack, Text, color, radius, space } from '@gloe/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { LocationPickerSheet } from './LocationPickerSheet';
import { useSelectedLocation } from './SelectedLocationProvider';

/**
 * Tappable pill showing the currently selected city. Opens the bottom sheet
 * picker on tap.
 */
export function LocationPill() {
  const { location } = useSelectedLocation();
  const [open, setOpen] = useState(false);

  // Strip the state suffix for a tighter pill (e.g. "San Diego, CA" -> "San Diego")
  const display = location.label.split(',')[0] ?? location.label;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
          paddingHorizontal: space[3],
          paddingVertical: space[2],
          borderRadius: radius.pill,
          backgroundColor: color.surface.secondary,
        }}
      >
        <Text variant="body-sm" tone="primary" weight="semibold">
          📍
        </Text>
        <Text variant="body-md" tone="primary" weight="semibold">
          {display}
        </Text>
        <Text variant="body-sm" tone="tertiary" weight="semibold">
          ▾
        </Text>
      </Pressable>

      <LocationPickerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
