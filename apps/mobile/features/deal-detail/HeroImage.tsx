import { color, radius, shadow, space } from '@gloe/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeroImageProps {
  images: string[];
  isSaved: boolean;
  onSave: () => void;
  onShare: () => void;
}

export function HeroImage({ images, isSaved, onSave, onShare }: HeroImageProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const aspectRatio = 4 / 3;
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
          <Image
            source={{ uri: item }}
            style={{ width: screenWidth, height }}
            resizeMode="cover"
          />
        )}
      />

      {/* Top controls */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + space[2],
          left: space[4],
          right: space[4],
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <FloatingButton onPress={() => router.back()} icon="←" />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <FloatingButton onPress={onShare} icon="↗" />
          <FloatingButton
            onPress={onSave}
            icon={isSaved ? '♥' : '♡'}
            iconColor={isSaved ? color.accent[500] : color.text.primary}
          />
        </View>
      </View>

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
                backgroundColor: i === activeIndex ? color.surface.elevated : 'rgba(255,255,255,0.6)',
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
          <Text style={{ color: color.text.inverse, fontSize: 12, fontWeight: '600' }}>
            {activeIndex + 1} / {images.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface FloatingButtonProps {
  onPress: () => void;
  icon: string;
  iconColor?: string;
}

function FloatingButton({ onPress, icon, iconColor = color.text.primary }: FloatingButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: color.surface.elevated,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.sm,
      }}
    >
      <Text style={{ fontSize: 18, color: iconColor, fontWeight: '600' }}>{icon}</Text>
    </Pressable>
  );
}
