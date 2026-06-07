import { Text } from '@gloe/ui';
import { View } from 'react-native';

// Matches the web ribbon (apps/web .../consumer/DealCard.tsx): a small rose tab
// flush to the image's left edge, rounded on the right only. Kept as a literal
// rose so web + mobile read identically regardless of theme brand tuning.
const ROSE = '#B05A6B';

/**
 * "TRENDING" ribbon overlay. Drop inside an image container that is
 * `position: 'relative'`; it pins itself to the bottom-left edge.
 */
export function TrendingRibbon({ bottom = 12 }: { bottom?: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom,
        left: 0,
        backgroundColor: ROSE,
        paddingHorizontal: 8,
        paddingVertical: 3,
        // Flush to the left edge, rounded on the right — a ribbon tab.
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text
        variant="caption"
        tone="inverse"
        weight="bold"
        style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}
      >
        Trending
      </Text>
    </View>
  );
}
