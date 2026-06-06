import { radius, shadow, useTheme } from '@gloe/ui';
import { Pressable } from 'react-native';

import { Icon } from '../icon/Icon';

interface MapButtonProps {
  onPress: () => void;
}

/**
 * Square map-view entry point, sits to the right of the search bar. Mirrors
 * ResortPass's square map button: a Gloē-brand square (slightly rounded) with a
 * white map icon framed inside. Tap opens the full-screen map discovery view.
 *
 * Sized to match the SearchBar's height (icon 18 + body-md vertical padding) so
 * the two read as one control.
 */
export function MapButton({ onPress }: MapButtonProps) {
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel="Open map view"
      style={{
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: palette.brand[500],
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.sm,
      }}
    >
      <Icon name="map" size={22} color="#fff" strokeWidth={2} />
    </Pressable>
  );
}
