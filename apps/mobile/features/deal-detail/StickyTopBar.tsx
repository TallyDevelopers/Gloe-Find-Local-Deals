import { radius, shadow, space, useTheme } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../icon/Icon';

interface StickyTopBarProps {
  scrollY: SharedValue<number>;
  /** Hero height — the bar background fades in as you scroll past it. */
  heroHeight: number;
}

/**
 * Always-reachable back button on the deal screen. Floats over the hero photo at
 * the top (transparent), then fades in a solid ivory bar once you scroll into
 * the content. Save/share live in the bottom action bar (thumb-reachable).
 */
export function StickyTopBar({ scrollY, heroHeight }: StickyTopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();

  // Fade the bar's solid background in over the back half of the hero scroll.
  const barBg = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [heroHeight * 0.5, heroHeight * 0.9], [0, 1], 'clamp'),
  }));

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + space[2],
        paddingBottom: space[2],
        paddingHorizontal: space[4],
        zIndex: 100,
      }}
      pointerEvents="box-none"
    >
      {/* Solid ivory backdrop that fades in on scroll */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: palette.surface.primary,
            borderBottomWidth: 1,
            borderBottomColor: palette.border.subtle,
          },
          barBg,
        ]}
      />
      <View style={{ flexDirection: 'row' }}>
        <FloatingButton onPress={() => router.back()} iconName="chevronLeft" />
      </View>
    </View>
  );
}

function FloatingButton({
  onPress,
  iconName,
  iconColor,
  iconFill = 'none',
}: {
  onPress: () => void;
  iconName: IconName;
  iconColor?: string;
  iconFill?: string;
}) {
  const { color: palette } = useTheme();
  const resolvedIconColor = iconColor ?? palette.text.primary;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: palette.surface.elevated,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.sm,
      }}
    >
      <Icon name={iconName} size={20} color={resolvedIconColor} fill={iconFill} strokeWidth={2.25} />
    </Pressable>
  );
}
