import { Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '../icon/Icon';

export interface CategoryOption {
  slug: string | null;  // null = "All"
  label: string;
}

/**
 * v0 category list. Matches the seed taxonomy in the DB. Eventually fetched
 * from `service_categories` table via a `categories.list` tRPC procedure.
 */
export const CATEGORY_OPTIONS: CategoryOption[] = [
  { slug: null, label: 'All' },
  { slug: 'injectables', label: 'Injectables' },
  { slug: 'skin', label: 'Skin' },
  { slug: 'laser', label: 'Laser' },
  { slug: 'body', label: 'Body' },
  { slug: 'wellness', label: 'Wellness' },
  { slug: 'other', label: 'Other' },
];

interface FilterPillsProps {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  onOpenFilters?: () => void;
  /** Number of advanced filters currently applied (distance/price/discount). */
  activeFilterCount?: number;
}

/**
 * Horizontal scrollable category pills with an optional "more filters" button
 * on the right edge. Tapping a pill swaps the active filter.
 */
export function FilterPills({ selectedSlug, onSelect, onOpenFilters, activeFilterCount = 0 }: FilterPillsProps) {
  const { color: palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: space[2],
          paddingRight: space[3],
        }}
        style={{ flex: 1 }}
      >
        {CATEGORY_OPTIONS.map((option) => {
          const isActive = option.slug === selectedSlug;
          return (
            <Pressable
              key={option.slug ?? 'all'}
              onPress={() => onSelect(option.slug)}
              style={{
                paddingHorizontal: space[4],
                paddingVertical: space[2],
                borderRadius: radius.pill,
                backgroundColor: isActive ? palette.text.primary : palette.surface.elevated,
                borderWidth: 1,
                borderColor: isActive ? palette.text.primary : palette.border.subtle,
              }}
            >
              <Text
                variant="body-sm"
                tone={isActive ? 'inverse' : 'primary'}
                weight="semibold"
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {onOpenFilters ? (
        <Pressable
          onPress={onOpenFilters}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            backgroundColor: activeFilterCount > 0 ? palette.brand[500] : palette.surface.elevated,
            borderWidth: 1,
            borderColor: activeFilterCount > 0 ? palette.brand[500] : palette.border.subtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: space[2],
            position: 'relative',
          }}
        >
          <Icon
            name="filters"
            size={16}
            color={activeFilterCount > 0 ? '#fff' : palette.text.primary}
            strokeWidth={2.25}
          />
          {activeFilterCount > 0 ? (
            <View style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: palette.accent[500],
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              borderWidth: 1.5,
              borderColor: palette.surface.primary,
            }}>
              <Text variant="caption" tone="inverse" weight="bold" style={{ fontSize: 9, lineHeight: 12 }}>
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
