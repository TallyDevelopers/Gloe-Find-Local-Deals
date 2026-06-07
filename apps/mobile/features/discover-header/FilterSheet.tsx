import { BottomSheet, BottomSheetScrollView, Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Filters applied on top of the active category. All optional — undefined
 * means "no constraint." This shape is what the discover screen feeds to
 * trpc.deals.list, except `maxDistanceMiles` which it also passes there.
 */
export interface DiscoverFilters {
  maxDistanceMiles?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  minDiscountPct?: number;
}

interface FilterSheetProps {
  open: boolean;
  initial: DiscoverFilters;
  onClose: () => void;
  onApply: (next: DiscoverFilters) => void;
}

// Chip options for each filter. Each option maps to a partial DiscoverFilters
// patch — keeps the apply logic dumb (just spread the chosen patch).
const DISTANCE_OPTS: { label: string; patch: Pick<DiscoverFilters, 'maxDistanceMiles'> }[] = [
  { label: '5 mi',    patch: { maxDistanceMiles: 5 } },
  { label: '10 mi',   patch: { maxDistanceMiles: 10 } },
  { label: '25 mi',   patch: { maxDistanceMiles: 25 } },
  { label: '50 mi',   patch: { maxDistanceMiles: 50 } },
  { label: 'Any',     patch: { maxDistanceMiles: undefined } },
];

const PRICE_OPTS: { label: string; patch: Pick<DiscoverFilters, 'minPriceCents' | 'maxPriceCents'> }[] = [
  { label: 'Any price',    patch: { minPriceCents: undefined, maxPriceCents: undefined } },
  { label: 'Under $100',   patch: { minPriceCents: undefined, maxPriceCents: 10000 } },
  { label: '$100–$300',    patch: { minPriceCents: 10000, maxPriceCents: 30000 } },
  { label: '$300–$700',    patch: { minPriceCents: 30000, maxPriceCents: 70000 } },
  { label: '$700+',        patch: { minPriceCents: 70000, maxPriceCents: undefined } },
];

const DISCOUNT_OPTS: { label: string; patch: Pick<DiscoverFilters, 'minDiscountPct'> }[] = [
  { label: 'Any',     patch: { minDiscountPct: undefined } },
  { label: '20%+',    patch: { minDiscountPct: 20 } },
  { label: '30%+',    patch: { minDiscountPct: 30 } },
  { label: '40%+',    patch: { minDiscountPct: 40 } },
  { label: '50%+',    patch: { minDiscountPct: 50 } },
];

export function FilterSheet({ open, initial, onClose, onApply }: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const [draft, setDraft] = useState<DiscoverFilters>(initial);

  // Re-sync local draft whenever the parent's filters change (e.g. user pressed
  // Clear externally) or the sheet is reopened.
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const distanceLabel = matchOption(DISTANCE_OPTS, draft, ['maxDistanceMiles']) ?? '50 mi';
  const priceLabel = matchOption(PRICE_OPTS, draft, ['minPriceCents', 'maxPriceCents']) ?? 'Any price';
  const discountLabel = matchOption(DISCOUNT_OPTS, draft, ['minDiscountPct']) ?? 'Any';

  const isClean =
    draft.maxDistanceMiles === undefined &&
    draft.minPriceCents === undefined &&
    draft.maxPriceCents === undefined &&
    draft.minDiscountPct === undefined;

  const apply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onApply(draft);
    onClose();
  };

  const clearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft({});
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="85%" style={{ paddingBottom: insets.bottom + space[3] }}>
      {/* Header */}
      <Stack direction="row" justify="space-between" align="center" style={{ paddingHorizontal: space[5], marginBottom: space[4] }}>
        <Text variant="display-sm" tone="primary" weight="medium">Filters</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text variant="body-md" tone="secondary" weight="medium">Done</Text>
        </Pressable>
      </Stack>

      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6] }}>
        <Stack gap={6}>
              <FilterSection
                title="Distance"
                helper={`Currently ${distanceLabel}`}
                options={DISTANCE_OPTS}
                isSelected={(opt) => optionMatches(opt, draft, ['maxDistanceMiles'])}
                onSelect={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              />
              <FilterSection
                title="Price"
                helper={`Currently ${priceLabel}`}
                options={PRICE_OPTS}
                isSelected={(opt) => optionMatches(opt, draft, ['minPriceCents', 'maxPriceCents'])}
                onSelect={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              />
              <FilterSection
                title="Discount"
                helper={`Currently ${discountLabel}`}
                options={DISCOUNT_OPTS}
                isSelected={(opt) => optionMatches(opt, draft, ['minDiscountPct'])}
                onSelect={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              />
        </Stack>
      </BottomSheetScrollView>

      {/* Footer actions */}
      <Stack direction="row" gap={3} style={{ paddingHorizontal: space[5], paddingTop: space[3], borderTopWidth: 1, borderTopColor: palette.border.subtle }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Clear all"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={clearAll}
            disabled={isClean}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button label="Apply" variant="primary" size="lg" fullWidth onPress={apply} />
        </View>
      </Stack>
    </BottomSheet>
  );
}

interface SectionProps<P extends Record<string, unknown>> {
  title: string;
  helper: string;
  options: { label: string; patch: P }[];
  isSelected: (opt: { label: string; patch: P }) => boolean;
  onSelect: (patch: P) => void;
}

function FilterSection<P extends Record<string, unknown>>({
  title, helper, options, isSelected, onSelect,
}: SectionProps<P>) {
  const { color: palette } = useTheme();
  return (
    <Stack gap={2}>
      <Stack gap={1}>
        <Text variant="body-md" tone="primary" weight="semibold">{title}</Text>
        <Text variant="caption" tone="tertiary">{helper}</Text>
      </Stack>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {options.map((opt) => {
          const active = isSelected(opt);
          return (
            <Pressable
              key={opt.label}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(opt.patch);
              }}
              style={{
                paddingHorizontal: space[4],
                paddingVertical: space[2],
                borderRadius: radius.pill,
                // Use the "anti-surface" pattern (matches the category pills above):
                // active chip flips to the opposite of the surface, so it reads
                // correctly in both light and dark mode. Brand color on a chip
                // here was too pale to support white text in light mode.
                backgroundColor: active ? palette.text.primary : palette.surface.elevated,
                borderWidth: 1,
                borderColor: active ? palette.text.primary : palette.border.default,
              }}
            >
              <Text
                variant="body-sm"
                weight="semibold"
                tone={active ? 'inverse' : 'primary'}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Stack>
  );
}

/**
 * Returns the label of the option whose patch keys match the current draft.
 * Used for the "Currently X" helper text under each section title.
 */
function matchOption<P extends Record<string, unknown>>(
  options: { label: string; patch: P }[],
  draft: DiscoverFilters,
  keys: (keyof DiscoverFilters)[],
): string | null {
  const match = options.find((opt) => optionMatches(opt, draft, keys));
  return match?.label ?? null;
}

function optionMatches<P extends Record<string, unknown>>(
  opt: { patch: P },
  draft: DiscoverFilters,
  keys: (keyof DiscoverFilters)[],
): boolean {
  return keys.every((k) => (opt.patch as Record<string, unknown>)[k as string] === draft[k]);
}
