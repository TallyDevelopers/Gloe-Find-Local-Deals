import { color } from '@gloe/ui';
import { Stack } from 'expo-router';

/**
 * Shared options for detail/checkout screens: a standard card push — slides in
 * from the right, swipe from the left edge to go back (Groupon-style). Edge-to-
 * edge, and the horizontal back-gesture never fights the vertical scroll.
 */
const SHEET = {
  animation: 'slide_from_right' as const,
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
};

/**
 * App stack. The bottom tabs live in (tabs); detail and checkout screens are
 * Stack siblings that push in from the right over the tab bar — swipe from the
 * left edge (or tap the back chevron) to return (Groupon-style).
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.surface.primary },
      }}
    >
      <Stack.Screen name="(tabs)" />
      {/* formSheet pinned to a tall 92% detent: a thin intentional peek at the
          top signals "pull down to dismiss" without the big default-modal gap.
          Native swipe-down comes free at this presentation. */}
      <Stack.Screen name="deal/[id]" options={SHEET} />
      <Stack.Screen name="vendor/[id]" options={SHEET} />
      <Stack.Screen name="my-deal/[id]" options={SHEET} />
      <Stack.Screen name="checkout" options={SHEET} />
      <Stack.Screen name="search" options={{ presentation: 'modal', gestureEnabled: true }} />
    </Stack>
  );
}
