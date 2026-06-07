import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, ScrollView } from 'react-native';

import { formatPrice } from '../discover/format';

interface VariantLike {
  id: string;
  label: string;
  dealPriceCents: number;
}

interface VariantPickerProps {
  variants: VariantLike[];
  selectedId: string;
  onSelect: (variantId: string) => void;
}

export function VariantPicker({ variants, selectedId, onSelect }: VariantPickerProps) {
  const { color: palette } = useTheme();
  if (variants.length <= 1) return null;

  return (
    <Stack gap={3}>
      <Text variant="label" tone="secondary">
        Choose option
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[2] }}
      >
        {variants.map((variant) => {
          const isSelected = variant.id === selectedId;
          return (
            <Pressable
              key={variant.id}
              onPress={() => onSelect(variant.id)}
              style={{
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: isSelected ? palette.brand[500] : palette.border.default,
                backgroundColor: isSelected ? palette.brand[50] : palette.surface.elevated,
                minWidth: 110,
              }}
            >
              <Stack gap={1} align="flex-start">
                <Text
                  variant="body-md"
                  tone={isSelected ? undefined : 'primary'}
                  weight={isSelected ? 'semibold' : 'medium'}
                  style={isSelected ? { color: palette.brand[800] } : undefined}
                >
                  {variant.label}
                </Text>
                <Text variant="body-sm" tone={isSelected ? 'brand' : 'secondary'} weight="semibold">
                  {formatPrice(variant.dealPriceCents)}
                </Text>
              </Stack>
            </Pressable>
          );
        })}
      </ScrollView>
    </Stack>
  );
}
