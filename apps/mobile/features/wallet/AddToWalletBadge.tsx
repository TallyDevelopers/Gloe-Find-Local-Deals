import { Image, Pressable } from 'react-native';

/**
 * Official "Add to Apple Wallet" badge. The PNG was rasterized from Apple's
 * downloadable US-UK RGB SVG (developer.apple.com → Wallet → Downloads).
 *
 * We use the rasterized PNG rather than `react-native-passkit-wallet`'s
 * `AddPassButton` because that wrapper is unmaintained (last release 2017)
 * and renders an older, smaller variant of PKAddPassButton. The PNG from
 * Apple's design downloads is the current-spec art, sharper, and renders
 * pixel-correct at 1x/2x/3x.
 *
 * The badge's intrinsic ratio is 165:50.
 */

const BADGE = require('../../assets/add-to-apple-wallet.png');
const ASPECT_RATIO = 165 / 50;

interface AddToWalletBadgeProps {
  onPress: () => void;
  disabled?: boolean;
  width?: number;
}

export function AddToWalletBadge({
  onPress,
  disabled = false,
  width = 220,
}: AddToWalletBadgeProps) {
  const height = width / ASPECT_RATIO;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Add to Apple Wallet"
      style={{ width, height, opacity: disabled ? 0.55 : 1 }}
    >
      <Image source={BADGE} style={{ width, height }} resizeMode="contain" />
    </Pressable>
  );
}
