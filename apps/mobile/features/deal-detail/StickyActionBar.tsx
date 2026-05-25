import { Button, Stack, radius, shadow, space, useTheme } from '@gloe/ui';
import { Pressable, View } from 'react-native';

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
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: palette.surface.elevated,
        borderTopWidth: 1,
        borderTopColor: palette.border.subtle,
        paddingHorizontal: space[5],
        paddingTop: space[3],
        // Sits just above the tab bar, which already clears the home indicator —
        // so only a small bottom pad, not the full safe-area inset.
        paddingBottom: space[3],
        ...shadow.lg,
      }}
    >
      <Stack direction="row" gap={3} align="center">
        <IconButton
          onPress={onSave}
          iconName="heart"
          iconColor={isSaved ? palette.accent[500] : palette.text.primary}
          iconFill={isSaved ? palette.accent[500] : 'none'}
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
  iconColor,
  iconFill = 'none',
}: IconButtonProps) {
  const { color: palette } = useTheme();
  const resolvedIconColor = iconColor ?? palette.text.primary;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 52,
        height: 52,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: palette.border.default,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={iconName} size={22} color={resolvedIconColor} fill={iconFill} strokeWidth={2.25} />
    </Pressable>
  );
}
