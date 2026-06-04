import { Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, ScrollView, View } from 'react-native';

import { trpc } from '@gloe/api-client';

import { Icon } from '../icon/Icon';

export interface CategoryOption {
  slug: string | null;  // null = "All"
  label: string;
}

/**
 * Fallback used until the categories.list query resolves on cold open. Mirrors
 * the active rows in `service_categories` so the UI doesn't flash empty.
 */
export const CATEGORY_OPTIONS: CategoryOption[] = [
  { slug: null, label: 'All' },
  { slug: 'injectables', label: 'Injectables' },
  { slug: 'skin', label: 'Skin' },
  { slug: 'laser', label: 'Laser' },
  { slug: 'weight-loss', label: 'Weight Loss' },
  { slug: 'body', label: 'Body & Contouring' },
  { slug: 'wellness', label: 'IV Therapy' },
  { slug: 'hormones-peptides', label: 'Hormones & Peptides' },
  { slug: 'other', label: 'Lashes & Eyes' },
];

/**
 * Live category list for the discover header — derived from the DB so adding a
 * category (e.g. flipping Beauty active) shows up on the home page without a
 * client release. Always prefixes an "All" pill at the front.
 */
export function useCategoryOptions(): CategoryOption[] {
  const q = trpc.categories.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  if (!q.data || q.data.length === 0) return CATEGORY_OPTIONS;
  return [{ slug: null, label: 'All' }, ...q.data.map((c) => ({ slug: c.slug, label: c.displayName }))];
}

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
  const options = useCategoryOptions();
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
        {options.map((option) => {
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
