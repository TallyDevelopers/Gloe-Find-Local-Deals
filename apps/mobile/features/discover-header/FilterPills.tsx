import { Text, color, radius, space } from '@gloe/ui';
import { Pressable, ScrollView, View } from 'react-native';

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
  { slug: 'botox', label: 'Botox' },
  { slug: 'filler', label: 'Filler' },
  { slug: 'skin', label: 'Skin' },
  { slug: 'body', label: 'Body' },
  { slug: 'wellness', label: 'Wellness' },
  { slug: 'hair', label: 'Hair' },
];

interface FilterPillsProps {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  onOpenFilters?: () => void;
}

/**
 * Horizontal scrollable category pills with an optional "more filters" button
 * on the right edge. Tapping a pill swaps the active filter.
 */
export function FilterPills({ selectedSlug, onSelect, onOpenFilters }: FilterPillsProps) {
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
                backgroundColor: isActive ? color.text.primary : color.surface.elevated,
                borderWidth: 1,
                borderColor: isActive ? color.text.primary : color.border.subtle,
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
            backgroundColor: color.surface.elevated,
            borderWidth: 1,
            borderColor: color.border.subtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: space[2],
          }}
        >
          <Text style={{ fontSize: 14, color: color.text.primary, fontWeight: '700' }}>
            ⚙
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
