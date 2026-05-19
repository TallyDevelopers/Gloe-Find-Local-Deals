import { color, fontFamily, fontSize, fontWeight } from '@gloe/ui';
import { Tabs } from 'expo-router';

import { TabIcon } from '../../features/tabs/TabIcon';

/**
 * Main app navigation — bottom tabs.
 * Open to everyone (anonymous + signed-in). Individual actions inside tabs
 * (redeem, save, review, message) gate themselves via useRequireAuth.
 *
 * Detail screens (deal/[id], vendor/[id]) live as siblings of (tabs) so they
 * push over the entire tab bar. See expo-router docs for the (tabs) +
 * Stack-sibling pattern.
 */
export default function AppLayout() {
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

      {/* Hide detail routes from the tab bar. They push over the tabs. */}
      <Tabs.Screen name="deal/[id]" options={{ href: null }} />
      <Tabs.Screen name="vendor/[id]" options={{ href: null }} />
      <Tabs.Screen name="my-deal/[id]" options={{ href: null }} />
    </Tabs>
  );
}
