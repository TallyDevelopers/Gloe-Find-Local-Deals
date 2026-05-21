import { Text } from 'react-native';

import { color } from './tokens';

export interface WordmarkProps {
  size?: number;
  /** 'gold' on light surfaces (default), 'light' on dark, 'dark' for mono. */
  tone?: 'gold' | 'light' | 'dark';
}

/**
 * The Gloē wordmark — the ONE place the logo is defined for mobile. Request it
 * anywhere with <Wordmark/>; change the font/color/weight here and it updates
 * everywhere. Outfit medium, wide tracking, rose gold. The ē carries the
 * macron (U+0113).
 */
export function Wordmark({ size = 40, tone = 'gold' }: WordmarkProps) {
  const tint =
    tone === 'gold' ? color.gold.DEFAULT : tone === 'light' ? color.text.inverse : color.text.primary;
  return (
    <Text
      allowFontScaling={false}
      style={{
        fontFamily: 'Outfit_600SemiBold',
        fontSize: size,
        letterSpacing: size * 0.14,
        color: tint,
        lineHeight: size * 1.1,
      }}
    >
      Gloē
    </Text>
  );
}
