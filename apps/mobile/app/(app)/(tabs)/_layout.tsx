import { color, fontFamily, fontSize, fontWeight } from '@gloe/ui';
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand[500],
        tabBarInactiveTintColor: color.text.tertiary,
        tabBarLabelStyle: {
          fontFamily: fontFamily.body,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
        },
        tabBarStyle: {
          backgroundColor: color.surface.elevated,
          borderTopColor: color.border.subtle,
          borderTopWidth: 1,
          height: 88,
          paddingTop: 8,
        },
        sceneStyle: { backgroundColor: color.surface.primary },
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
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => <TabIcon name="messages" focused={focused} />,
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
