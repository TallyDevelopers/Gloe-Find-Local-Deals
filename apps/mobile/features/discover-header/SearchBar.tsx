import { Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';

interface SearchBarProps {
  onPress: () => void;
}

/**
 * Treatments cycled in the placeholder. Keep these real, on-brand, and short —
 * they double as a hint of what's searchable. (ResortPass cycles
 * daycations/spas/pools; ours cycles treatments.)
 */
const CYCLE_WORDS = ['Botox', 'filler', 'lasers', 'CoolSculpting', 'facials', 'Semaglutide', 'microneedling'];

const VISIBLE_MS = 2000; // how long each word shows
const FADE_MS = 280;

/**
 * Display-only search bar. Tap navigates to the search screen. The placeholder
 * keeps "Search" fixed while the treatment word crossfades through CYCLE_WORDS —
 * a calm hint of what's searchable without a wall of text. Inline typing is
 * intentionally not supported here; the search screen owns the keyboard.
 */
export function SearchBar({ onPress }: SearchBarProps) {
  const { color: palette } = useTheme();
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      // Fade out, swap the word, fade back in.
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % CYCLE_WORDS.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, VISIBLE_MS);
    return () => clearInterval(id);
  }, [opacity]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="search"
      accessibilityLabel="Search treatments and spas"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.md,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        ...shadow.sm,
      }}
    >
      <Icon name="search" size={18} color={palette.text.tertiary} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="body-md" tone="tertiary">
          Search{' '}
        </Text>
        <Animated.Text
          numberOfLines={1}
          style={{
            opacity,
            color: palette.text.tertiary,
            fontFamily: 'GeneralSans',
            fontSize: 16,
          }}
        >
          {CYCLE_WORDS[index]}…
        </Animated.Text>
      </View>
    </Pressable>
  );
}
