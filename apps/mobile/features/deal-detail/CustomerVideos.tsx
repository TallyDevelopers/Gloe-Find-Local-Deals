import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';

import { CachedImage } from '../image/CachedImage';
import { Section } from './Section';

export interface InsideVendorVideo {
  id: string;
  thumbnailUrl: string;
  caption?: string;
  duration?: string;
}

interface CustomerVideosProps {
  videos: InsideVendorVideo[] | undefined;
  vendorName: string;
  onPlay?: (video: InsideVendorVideo) => void;
}

/**
 * Renders nothing unless the vendor uploaded at least one video. By design
 * — empty state on a public detail screen would feel like a content gap.
 *
 * Section header is "Inside [vendor]" — owns the vendor brand and works for
 * any kind of content (testimonials, behind-the-scenes, how-tos, etc.)
 */
export function CustomerVideos({ videos, vendorName, onPlay }: CustomerVideosProps) {
  if (!videos || videos.length === 0) return null;

  const screenWidth = Dimensions.get('window').width;
  // Card width: ~40% of screen so we see ~2.4 cards at a time
  const cardWidth = Math.round(screenWidth * 0.4);

  return (
    <Section title={`Inside ${vendorName}`}>
      <View style={{ marginHorizontal: -space[5] }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardWidth + space[3]}
          contentContainerStyle={{
            paddingHorizontal: space[5],
            gap: space[3],
          }}
        >
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              width={cardWidth}
              onPlay={() => onPlay?.(video)}
            />
          ))}
        </ScrollView>
      </View>
    </Section>
  );
}

interface VideoCardProps {
  video: InsideVendorVideo;
  width: number;
  onPlay: () => void;
}

function VideoCard({ video, width, onPlay }: VideoCardProps) {
  const { color: palette } = useTheme();
  return (
    <Pressable onPress={onPlay} style={{ width }}>
      <Stack gap={2}>
        <View
          style={{
            width: '100%',
            aspectRatio: 4 / 5,
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: palette.neutral[200],
            ...shadow.sm,
          }}
        >
          <CachedImage
            uri={video.thumbnailUrl}
            style={{ width: '100%', height: '100%' }}
          />
          {/* Play affordance */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
                alignItems: 'center',
                justifyContent: 'center',
                ...shadow.md,
              }}
            >
              <Text style={{ fontSize: 22, color: palette.text.primary, marginLeft: 4 }}>▶</Text>
            </View>
          </View>
          {video.duration ? (
            <View
              style={{
                position: 'absolute',
                bottom: space[2],
                right: space[2],
                backgroundColor: 'rgba(43, 32, 25, 0.7)',
                paddingHorizontal: space[2],
                paddingVertical: 2,
                borderRadius: radius.sm,
              }}
            >
              <Text variant="caption" tone="inverse" weight="semibold">
                {video.duration}
              </Text>
            </View>
          ) : null}
        </View>
        {video.caption ? (
          <Text variant="body-sm" tone="secondary" numberOfLines={2}>
            {video.caption}
          </Text>
        ) : null}
      </Stack>
    </Pressable>
  );
}
