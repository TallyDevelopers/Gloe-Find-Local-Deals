import { Stack, Text, color, radius, space } from '@gloe/ui';
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
                borderColor: isSelected ? color.brand[500] : color.border.default,
                backgroundColor: isSelected ? color.brand[50] : color.surface.elevated,
                minWidth: 110,
              }}
            >
              <Stack gap={1} align="flex-start">
                <Text
                  variant="body-md"
                  tone="primary"
                  weight={isSelected ? 'semibold' : 'medium'}
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
