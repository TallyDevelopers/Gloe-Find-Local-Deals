import { color } from '@gloe/ui';
import { Text } from 'react-native';

export type TabIconName = 'discover' | 'saved' | 'messages' | 'profile';

const glyphs: Record<TabIconName, { active: string; inactive: string }> = {
  discover: { active: '✦', inactive: '✦' },
  saved: { active: '♥', inactive: '♡' },
  messages: { active: '✉', inactive: '✉' },
  profile: { active: '●', inactive: '○' },
};

interface TabIconProps {
  name: TabIconName;
  focused: boolean;
  size?: number;
}

/**
 * Minimal tab icons using glyphs tuned to our typography. Swap for a proper
 * icon library (Phosphor / Lucide via react-native-svg) in a later patch —
 * the surface area is just this file.
 */
export function TabIcon({ name, focused, size = 22 }: TabIconProps) {
  const glyph = glyphs[name];
  return (
    <Text
      style={{
        fontSize: size,
        color: focused ? color.brand[500] : color.text.tertiary,
        fontWeight: focused ? '700' : '500',
        lineHeight: size * 1.1,
      }}
    >
      {focused ? glyph.active : glyph.inactive}
    </Text>
  );
}
