import { BottomSheet, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../icon/Icon';

interface AttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
}

/**
 * Branded bottom sheet for choosing how to attach media to a support message —
 * camera vs library. Slides up from the bottom (matches LocationPickerSheet),
 * styled in the rose-gold brand. Replaces the dated centered ActionSheetIOS.
 */
export function AttachmentSheet({ open, onClose, onTakePhoto, onChooseLibrary }: AttachmentSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();

  // Close the sheet (it animates out via `open` → false), then run the action.
  const closeThen = (then: () => void) => {
    onClose();
    then();
  };

  const Row = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => (
    <Pressable
      onPress={() => closeThen(onPress)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[4],
        paddingVertical: space[4],
        paddingHorizontal: space[3],
        borderRadius: radius.lg,
        backgroundColor: pressed ? palette.surface.secondary : 'transparent',
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          backgroundColor: palette.brand[100],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={palette.brand[600]} strokeWidth={2} />
      </View>
      <Text variant="body-lg" tone="primary" weight="semibold">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      style={{ paddingHorizontal: space[4], paddingBottom: insets.bottom + space[4] }}
    >
      <Stack gap={0}>
        <Row icon="camera" label="Take Photo or Video" onPress={onTakePhoto} />
        <View style={{ height: 1, backgroundColor: palette.border.subtle, marginLeft: 56 }} />
        <Row icon="image" label="Choose from Library" onPress={onChooseLibrary} />
      </Stack>

      <Pressable
        onPress={onClose}
        style={({ pressed }) => ({
          marginTop: space[2],
          paddingVertical: space[4],
          borderRadius: radius.lg,
          alignItems: 'center',
          backgroundColor: pressed ? palette.surface.secondary : palette.surface.elevated,
        })}
      >
        <Text variant="body-lg" tone="secondary" weight="semibold">
          Cancel
        </Text>
      </Pressable>
    </BottomSheet>
  );
}
