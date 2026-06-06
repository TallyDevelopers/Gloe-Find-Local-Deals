import { Text, space, useTheme } from '@gloe/ui';
import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useCategoryOptions } from './FilterPills';

interface CategoryTabsProps {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}

/**
 * Primary category switcher — ResortPass-style underline tabs (All · Injectables
 * · Skin · …), visually distinct from the filter pills below them. Text-only
 * with an underline on the active tab; horizontally scrollable since we have
 * more categories than fit. This is the "what am I browsing" control; the pill
 * row beneath it is "refine what I'm browsing."
 */
export function CategoryTabs({ selectedSlug, onSelect }: CategoryTabsProps) {
  const { color: palette } = useTheme();
  const options = useCategoryOptions();
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: palette.border.subtle }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space[4], gap: space[5] }}
      >
        {options.map((option) => {
          const isActive = option.slug === selectedSlug;
          return (
            <Pressable
              key={option.slug ?? 'all'}
              onPress={() => onSelect(option.slug)}
              hitSlop={6}
              style={{ paddingVertical: space[2] }}
            >
              <Text
                variant="body-md"
                weight={isActive ? 'semibold' : 'medium'}
                tone={isActive ? 'primary' : 'tertiary'}
              >
                {option.label}
              </Text>
              {/* Active underline — sits flush with the row's bottom border. */}
              <View
                style={{
                  height: 2,
                  marginTop: space[2],
                  borderRadius: 1,
                  backgroundColor: isActive ? palette.text.primary : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
