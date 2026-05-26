import { useTheme } from '@gloe/ui';

import { Icon, type IconName } from '../icon/Icon';

export type TabIconName = 'discover' | 'saved' | 'wallet' | 'profile';

const iconForTab: Record<TabIconName, IconName> = {
  discover: 'tab.discover',
  saved: 'tab.saved',
  wallet: 'tab.wallet',
  profile: 'tab.profile',
};

interface TabIconProps {
  name: TabIconName;
  focused: boolean;
  size?: number;
}

/**
 * Bottom tab icons. Lucide line icons; the active state gets a thicker
 * stroke + brand-color fill on heart-shaped icons (saved tab).
 */
export function TabIcon({ name, focused, size = 22 }: TabIconProps) {
  const { color: palette } = useTheme();
  const iconName = iconForTab[name];
  const tint = focused ? palette.brand[500] : palette.text.tertiary;
  // The saved tab is the heart icon — fill it when focused so it reads as "active heart"
  const fill = focused && name === 'saved' ? palette.brand[500] : 'none';
  return (
    <Icon
      name={iconName}
      size={size}
      color={tint}
      fill={fill}
      strokeWidth={focused ? 2.25 : 1.75}
    />
  );
}
