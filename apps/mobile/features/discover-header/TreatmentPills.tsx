import { trpc } from '@gloe/api-client';
import { Text, radius, space, useTheme } from '@gloe/ui';
import { Pressable, ScrollView } from 'react-native';

interface TreatmentPillsProps {
  /** The selected category to drill into. */
  categorySlug: string;
  /** Currently selected treatment, or null for "all of this category". */
  selectedSubtype: string | null;
  onSelect: (subtypeSlug: string | null) => void;
  userLat?: number;
  userLng?: number;
  maxDistanceMiles?: number;
}

/**
 * Optional second pill row: the treatments under the selected category that
 * have enough nearby inventory to be worth drilling into.
 *
 * Self-gating by design — renders NOTHING unless at least two treatments clear
 * the inventory floor (`minDeals` on the server). So with thin inventory the
 * header stays a single calm row of categories; as vendors are added and
 * treatments fill out, this row appears on its own. Drilling is always
 * optional: a leading "All {category}" pill resets to the whole category.
 */
export function TreatmentPills({
  categorySlug,
  selectedSubtype,
  onSelect,
  userLat,
  userLng,
  maxDistanceMiles,
}: TreatmentPillsProps) {
  const { color: palette } = useTheme();
  const q = trpc.deals.categoryTreatments.useQuery(
    { categorySlug, userLat, userLng, maxDistanceMiles, minDeals: 2 },
    { staleTime: 60_000 },
  );
  const treatments = q.data ?? [];

  // Cold-start guard: a single drillable treatment is the same as the category,
  // so only show the row when there are ≥2 real choices.
  if (treatments.length < 2) return null;

  const pill = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        paddingHorizontal: space[3],
        paddingVertical: space[1] + 2,
        borderRadius: radius.pill,
        backgroundColor: active ? palette.brand[500] : palette.surface.elevated,
        borderWidth: 1,
        borderColor: active ? palette.brand[500] : palette.border.subtle,
      }}
    >
      <Text variant="caption" tone={active ? 'inverse' : 'secondary'} weight="semibold">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingRight: space[5], paddingTop: space[2] }}
    >
      {pill('__all', 'All', selectedSubtype === null, () => onSelect(null))}
      {treatments.map((t) => {
        const slug = t.subtypeSlug;
        if (!slug) return null;
        return pill(slug, t.term, selectedSubtype === slug, () => onSelect(slug));
      })}
    </ScrollView>
  );
}
