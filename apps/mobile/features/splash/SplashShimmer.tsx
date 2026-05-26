import { Wordmark, useTheme } from '@gloe/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import MaskedView from '@react-native-masked-view/masked-view';

const { width } = Dimensions.get('window');

/**
 * First-launch splash: the rose-gold Gloē wordmark with a brighter gold band
 * that sweeps left→right across it once, then the whole overlay fades away to
 * reveal the app. Purely cosmetic; calls onDone when finished.
 */
export function SplashShimmer({ onDone }: { onDone: () => void }) {
  const { color: palette } = useTheme();
  const sweep = useSharedValue(-1); // -1 (off left) → 1 (off right)
  const fade = useSharedValue(1);

  useEffect(() => {
    // Sweep the shimmer across, then fade the overlay out.
    sweep.value = withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) });
    fade.value = withDelay(
      1300,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.ease) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [sweep, fade, onDone]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * width }],
  }));

  return (
    <Animated.View
      style={[styles.overlay, { backgroundColor: palette.surface.primary }, overlayStyle]}
      pointerEvents="none"
    >
      <MaskedView
        style={styles.mask}
        maskElement={
          <View style={styles.center}>
            <Wordmark size={56} tone="gold" />
          </View>
        }
      >
        {/* Base rose-gold fill */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.gold.DEFAULT }]} />
        {/* The travelling shimmer band */}
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', '#F3D9C9', '#FFFFFF', '#F3D9C9', 'transparent']}
            locations={[0, 0.35, 0.5, 0.65, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </MaskedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  mask: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
});
