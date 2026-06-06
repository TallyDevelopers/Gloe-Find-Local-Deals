import { Text, useTheme } from '@gloe/ui';
import { View } from 'react-native';

/**
 * Teal spa pin — a filled drop, darkened when it's the active/selected spa
 * (matches the ResortPass reference where the focused pin goes navy-dark).
 */
export function SpaMarker({ active }: { active: boolean }) {
  const { color: palette } = useTheme();
  const bg = active ? palette.text.primary : palette.brand[500];
  return (
    <View
      style={{
        width: active ? 26 : 20,
        height: active ? 26 : 20,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 3,
        borderColor: '#fff',
        // a subtle drop shadow reads as a pin sitting on the map
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        elevation: 3,
      }}
    />
  );
}

/** Count bubble for a cluster of nearby spas — grows slightly with count. */
export function ClusterMarker({ count }: { count: number }) {
  const { color: palette } = useTheme();
  const size = count >= 50 ? 52 : count >= 10 ? 46 : 40;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: palette.brand[500],
        borderWidth: 3,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        elevation: 3,
      }}
    >
      <Text variant="body-sm" tone="inverse" weight="bold">
        {count}
      </Text>
    </View>
  );
}
