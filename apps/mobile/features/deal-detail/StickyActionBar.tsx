import { Button, Stack, color, radius, shadow, space } from '@gloe/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../icon/Icon';

interface StickyActionBarProps {
  isSaved: boolean;
  onSave: () => void;
  onShare: () => void;
  onRedeem: () => void;
  ctaLabel: string;
}

export function StickyActionBar({
  isSaved,
  onSave,
  onShare,
  onRedeem,
  ctaLabel,
}: StickyActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: color.surface.elevated,
        borderTopWidth: 1,
        borderTopColor: color.border.subtle,
        paddingHorizontal: space[5],
        paddingTop: space[3],
        paddingBottom: insets.bottom + space[3],
        ...shadow.lg,
      }}
    >
      <Stack direction="row" gap={3} align="center">
        <IconButton
          onPress={onSave}
          iconName="heart"
          iconColor={isSaved ? color.accent[500] : color.text.primary}
          iconFill={isSaved ? color.accent[500] : 'none'}
        />
        <IconButton onPress={onShare} iconName="share" />
        <View style={{ flex: 1 }}>
          <Button label={ctaLabel} onPress={onRedeem} size="lg" fullWidth />
        </View>
      </Stack>
    </View>
  );
}

interface IconButtonProps {
  onPress: () => void;
  iconName: IconName;
  iconColor?: string;
  iconFill?: string;
}

function IconButton({
  onPress,
  iconName,
  iconColor = color.text.primary,
  iconFill = 'none',
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 52,
        height: 52,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: color.border.default,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={iconName} size={22} color={iconColor} fill={iconFill} strokeWidth={2.25} />
    </Pressable>
  );
}
