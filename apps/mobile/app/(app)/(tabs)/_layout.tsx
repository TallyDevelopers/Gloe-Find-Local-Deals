import { fontFamily, fontSize, fontWeight, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';

import { TabIcon } from '../../../features/tabs/TabIcon';

/**
 * Bottom tabs. Open to everyone (anonymous + signed-in). Individual actions
 * inside tabs (redeem, save, review, message) gate themselves via
 * useRequireAuth.
 *
 * Detail/checkout screens live one level up in (app) as Stack siblings, so
 * they present as swipe-down modals over the entire tab bar.
 */
export default function TabsLayout() {
  const { color: palette } = useTheme();
  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.brand[500],
        tabBarInactiveTintColor: palette.text.tertiary,
        tabBarLabelStyle: {
          fontFamily: fontFamily.body,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
        },
        tabBarStyle: {
          backgroundColor: palette.surface.elevated,
          borderTopColor: palette.border.subtle,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
        },
        sceneStyle: { backgroundColor: palette.surface.primary },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon name="discover" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused }) => <TabIcon name="saved" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused }) => <TabIcon name="wallet" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
