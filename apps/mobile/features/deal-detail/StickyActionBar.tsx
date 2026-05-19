import { Button, Stack, Text, color, radius, shadow, space } from '@gloe/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
        <IconButton onPress={onSave} icon={isSaved ? '♥' : '♡'} active={isSaved} />
        <IconButton onPress={onShare} icon="↗" />
        <View style={{ flex: 1 }}>
          <Button label={ctaLabel} onPress={onRedeem} size="lg" fullWidth />
        </View>
      </Stack>
    </View>
  );
}

interface IconButtonProps {
  onPress: () => void;
  icon: string;
  active?: boolean;
}

function IconButton({ onPress, icon, active }: IconButtonProps) {
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
      <Text
        style={{
          fontSize: 22,
          color: active ? color.accent[500] : color.text.primary,
          fontWeight: '600',
        }}
      >
        {icon}
      </Text>
    </Pressable>
  );
}
