import { Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, ScrollView } from 'react-native';

import { Icon } from '../icon/Icon';
import type { FilterFocus } from './MapFilterSheet';
import { activeFilterCount, type MapFilters } from './mapFilters';

interface MapFilterChipsProps {
  filters: MapFilters;
  onOpen: (focus: FilterFocus) => void;
}

/**
 * The static filter-chip row that sits under the location bar (ResortPass:
 * Filter · Amenities · Guest Rating · Vibes). Ours: a "Filter" button (opens
 * everything) plus per-dimension chips that open the sheet focused on that
 * section. Each chip reflects its active value inline so the row reads as the
 * current filter state at a glance.
 */
export function MapFilterChips({ filters, onOpen }: MapFilterChipsProps) {
  const { color: palette } = useTheme();
  const count = activeFilterCount(filters);

  const vibeLabel = filters.vibes.length > 0 ? `Vibe · ${filters.vibes.length}` : 'Vibe';
  const ratingLabel = filters.minRating ? `${filters.minRating}★+` : 'Rating';
  const priceActive = filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined;
  const sortActive = filters.sort !== undefined;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingRight: space[4] }}
    >
      {/* Filter — opens the full sheet, shows a count badge when active. */}
      <Pressable
        onPress={() => onOpen('all')}
        style={[chipStyle(palette, count > 0), { flexDirection: 'row', alignItems: 'center', gap: space[1] }]}
      >
        <Icon name="filters" size={14} color={count > 0 ? '#fff' : palette.text.primary} strokeWidth={2.25} />
        <Text variant="body-sm" weight="semibold" tone={count > 0 ? 'inverse' : 'primary'}>
          {count > 0 ? `Filter · ${count}` : 'Filter'}
        </Text>
      </Pressable>

      <Chip label={vibeLabel} active={filters.vibes.length > 0} onPress={() => onOpen('vibes')} hasCaret palette={palette} />
      <Chip label={priceActive ? 'Price ·' : 'Price'} active={priceActive} onPress={() => onOpen('price')} hasCaret palette={palette} />
      <Chip label={ratingLabel} active={!!filters.minRating} onPress={() => onOpen('rating')} hasCaret palette={palette} />
      <Chip label="Sort" active={sortActive} onPress={() => onOpen('sort')} hasCaret palette={palette} />
    </ScrollView>
  );
}

function Chip({
  label, active, onPress, hasCaret, palette,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  hasCaret?: boolean;
  palette: ReturnType<typeof useTheme>['color'];
}) {
  return (
    <Pressable onPress={onPress} style={[chipStyle(palette, active), { flexDirection: 'row', alignItems: 'center', gap: space[1] }]}>
      <Text variant="body-sm" weight="semibold" tone={active ? 'inverse' : 'primary'}>
        {label}
      </Text>
      {hasCaret ? (
        <Icon name="chevronDown" size={14} color={active ? '#fff' : palette.text.secondary} strokeWidth={2.25} />
      ) : null}
    </Pressable>
  );
}

function chipStyle(palette: ReturnType<typeof useTheme>['color'], active: boolean) {
  return {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.pill,
    backgroundColor: active ? palette.text.primary : palette.surface.elevated,
    borderWidth: 1,
    borderColor: active ? palette.text.primary : palette.border.subtle,
  } as const;
}
