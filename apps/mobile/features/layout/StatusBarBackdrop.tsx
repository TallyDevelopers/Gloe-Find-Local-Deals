import { useTheme } from '@gloe/ui';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Solid surface-colored strip behind the iOS status bar. Sits above any
 * scrolled content so deal photos, vendor titles, etc. don't bleed under the
 * time/signal/battery indicators while the user scrolls.
 *
 * Render this as a sibling of the screen's main ScrollView (NOT inside it),
 * with `position: 'absolute'` so it doesn't push content down.
 *
 * Usage:
 *   <View style={{ flex: 1 }}>
 *     <ScrollView>...</ScrollView>
 *     <StatusBarBackdrop />
 *   </View>
 */
export function StatusBarBackdrop() {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: palette.surface.primary,
        zIndex: 100,
      }}
    />
  );
}
