import { Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, View } from 'react-native';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { color: palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: palette.surface.secondary,
        borderRadius: radius.pill,
        padding: space[1],
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              paddingVertical: space[2],
              paddingHorizontal: space[3],
              borderRadius: radius.pill,
              backgroundColor: isActive ? palette.surface.elevated : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: space[2],
            }}
          >
            <Text
              variant="body-md"
              tone={isActive ? 'primary' : 'secondary'}
              weight={isActive ? 'semibold' : 'medium'}
            >
              {option.label}
            </Text>
            {option.badge !== undefined && option.badge > 0 ? (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  paddingHorizontal: 4,
                  backgroundColor: isActive ? palette.brand[500] : palette.neutral[400],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="caption" tone="inverse" weight="bold">
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
