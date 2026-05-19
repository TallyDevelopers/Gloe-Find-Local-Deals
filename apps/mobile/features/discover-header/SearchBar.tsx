import { Text, color, radius, shadow, space } from '@gloe/ui';
import { Pressable, View } from 'react-native';

interface SearchBarProps {
  onPress: () => void;
}

/**
 * Display-only search bar. Tap navigates to the search screen.
 * Inline typing is intentionally not supported here — keeping it as a tap
 * target keeps the home screen calm and lets the search screen own the
 * keyboard, results, recents, etc.
 */
export function SearchBar({ onPress }: SearchBarProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        backgroundColor: color.surface.elevated,
        borderRadius: radius.pill,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        ...shadow.sm,
      }}
    >
      <Text style={{ fontSize: 16, color: color.text.tertiary }}>🔍</Text>
      <View style={{ flex: 1 }}>
        <Text variant="body-md" tone="tertiary">
          Search Botox, filler, lasers…
        </Text>
      </View>
    </Pressable>
  );
}
