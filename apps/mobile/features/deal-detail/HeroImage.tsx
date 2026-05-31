import { radius, space, useTheme } from '@gloe/ui';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text,
  View,
} from 'react-native';

import { CachedImage } from '../image/CachedImage';

interface HeroImageProps {
  images: string[];
}

export function HeroImage({ images }: HeroImageProps) {
  const { color: palette } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const aspectRatio = 3 / 2; // a touch shorter than 4:3 — less screen real estate
  const height = screenWidth / aspectRatio;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (index !== activeIndex) setActiveIndex(index);
  };

  return (
    <View style={{ width: screenWidth, height, position: 'relative' }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(uri) => uri}
        renderItem={({ item }) => (
          <CachedImage
            uri={item}
            style={{ width: screenWidth, height }}
          />
        )}
      />

      {/* Page indicator dots */}
      {images.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: space[4],
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: space[1],
          }}
        >
          {images.map((uri, i) => (
            <View
              key={uri}
              style={{
                width: i === activeIndex ? 24 : 6,
                height: 6,
                borderRadius: radius.pill,
                backgroundColor: i === activeIndex ? palette.surface.elevated : 'rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Image counter */}
      {images.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: space[4],
            right: space[4],
            backgroundColor: 'rgba(43, 32, 25, 0.6)',
            paddingHorizontal: space[2],
            paddingVertical: 2,
            borderRadius: radius.pill,
          }}
        >
          <Text style={{ color: palette.text.inverse, fontSize: 12, fontWeight: '600' }}>
            {activeIndex + 1} / {images.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

