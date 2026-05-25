import { Text, radius, space, useTheme } from '@gloe/ui';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '../icon/Icon';
import { LocationPickerSheet } from './LocationPickerSheet';
import { useSelectedLocation } from './SelectedLocationProvider';

/**
 * Tappable pill showing the currently selected city. Opens the bottom sheet
 * picker on tap.
 */
export function LocationPill() {
  const { location } = useSelectedLocation();
  const { color: palette } = useTheme();
  const [open, setOpen] = useState(false);

  // Strip the state suffix for a tighter pill ("San Diego, CA" -> "San Diego")
  const display = location.label.split(',')[0] ?? location.label;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingHorizontal: space[3],
          paddingVertical: space[2],
          borderRadius: radius.pill,
          backgroundColor: palette.surface.secondary,
        }}
      >
        <Icon name="pin" size={16} color={palette.text.primary} strokeWidth={2.25} />
        <Text variant="body-md" tone="primary" weight="semibold">
          {display}
        </Text>
        <Icon name="chevronDown" size={14} color={palette.text.tertiary} strokeWidth={2.5} />
      </Pressable>

      <LocationPickerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
