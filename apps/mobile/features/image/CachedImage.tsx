import { Image, type ImageProps, type ImageContentFit } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

interface CachedImageProps extends Omit<ImageProps, 'contentFit' | 'style'> {
  /** Image source URI (or null/undefined while loading upstream data). */
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  /** Defaults to 'cover' (was resizeMode on the old RN Image). */
  contentFit?: ImageContentFit;
}

/**
 * App-wide image component. Wraps expo-image so every photo across Discover,
 * vouchers, vendor pages, etc. gets the same behavior:
 *   - memory + disk caching → an image loaded once NEVER re-downloads (kills
 *     the "pictures load one by one every time" problem).
 *   - a smooth 200ms fade-in instead of a hard pop.
 *   - high-quality downsampling (the default expo-image decoder is sharp).
 * Drop-in for the old `<Image source={{uri}} resizeMode="cover" />`.
 */
export function CachedImage({ uri, style, contentFit = 'cover', ...rest }: CachedImageProps) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      style={style}
      contentFit={contentFit}
      // Cache aggressively: serve from memory, fall back to disk, only hit the
      // network on a true first load.
      cachePolicy="memory-disk"
      transition={200}
      // Render at the device's pixel density for crisp, high-quality photos.
      {...rest}
    />
  );
}

/**
 * Warm images into the cache BEFORE they're rendered (e.g. prefetch the deal
 * photos for the cards already loaded in the feed) so they appear instantly.
 */
export function prefetchImages(uris: (string | null | undefined)[]) {
  const valid = uris.filter((u): u is string => !!u);
  if (valid.length) void Image.prefetch(valid, { cachePolicy: 'memory-disk' });
}
