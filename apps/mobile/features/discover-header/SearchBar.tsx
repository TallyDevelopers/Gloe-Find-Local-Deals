import { Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { Icon } from '../icon/Icon';

interface SearchBarProps {
  onPress: () => void;
  /**
   * The city you're browsing, shown as a tappable segment on the LEFT of the
   * bar ("📍 San Diego │ 🔍 Search lasers…"). Tapping it fires onPressLocation
   * (the picker) instead of onPress (the search screen) — two targets, one pill.
   * Omit both to render a plain search bar (no location segment), e.g. before a
   * location is set.
   */
  locationLabel?: string;
  onPressLocation?: () => void;
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
 * Display-only search bar. The location lives INSIDE the bar as a left segment
 * (ResortPass/Airbnb pattern) rather than as a separate floating pill — every
 * standalone placement we tried either collided with the cycling placeholder or
 * left dead real-estate on its own line. As one control, nothing floats and
 * nothing collides: the city truncates on its side of the divider, the search
 * placeholder crossfades on its side.
 *
 * Two tap targets: the city segment → onPressLocation (the picker), the rest →
 * onPress (the search screen). Inline typing is intentionally not supported
 * here; the search screen owns the keyboard.
 */
export function SearchBar({ onPress, locationLabel, onPressLocation }: SearchBarProps) {
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

  const showLocation = !!locationLabel && !!onPressLocation;
  // Strip the state suffix for a tighter segment ("San Diego, CA" → "San Diego").
  const cityDisplay = locationLabel ? (locationLabel.split(',')[0] ?? locationLabel) : '';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.surface.elevated,
        borderRadius: radius.md,
        ...shadow.sm,
      }}
    >
      {showLocation ? (
        <>
          <Pressable
            onPress={onPressLocation}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Browsing ${locationLabel}. Tap to change location.`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[1],
              maxWidth: 132,
              paddingLeft: space[4],
              paddingRight: space[3],
              paddingVertical: space[3],
            }}
          >
            <Icon name="pin" size={16} color={palette.text.primary} strokeWidth={2.25} />
            <Text variant="body-md" tone="primary" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {cityDisplay}
            </Text>
          </Pressable>
          {/* Hairline divider between the two targets. */}
          <View style={{ width: 1, alignSelf: 'stretch', marginVertical: space[2], backgroundColor: palette.border.subtle }} />
        </>
      ) : null}

      <Pressable
        onPress={onPress}
        hitSlop={4}
        accessibilityRole="search"
        accessibilityLabel="Search treatments and spas"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingLeft: showLocation ? space[3] : space[4],
          paddingRight: space[4],
          paddingVertical: space[3],
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
    </View>
  );
}
