import { trpc } from '@gloe/api-client';
import { Button, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EMPTY_MAP_FILTERS,
  PRICE_OPTS,
  RATING_OPTS,
  SORT_OPTS,
  type MapFilters,
} from './mapFilters';

/** Which section to scroll the user to when the sheet opens (one per chip). */
export type FilterFocus = 'all' | 'price' | 'rating' | 'sort' | 'vibes';

interface MapFilterSheetProps {
  open: boolean;
  focus: FilterFocus;
  initial: MapFilters;
  onClose: () => void;
  onApply: (next: MapFilters) => void;
}

/**
 * The map's filter sheet. One component, several sections (Vibe / Price /
 * Rating / Sort) — each chip in the map header opens it focused on its section
 * via `focus` (which sections to render). "Filter" opens all of them. Every
 * control maps straight onto `deals.list` inputs, so applying is a spread.
 */
export function MapFilterSheet({ open, focus, initial, onClose, onApply }: MapFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const [draft, setDraft] = useState<MapFilters>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const vibesQuery = trpc.categories.vibes.useQuery(undefined, { staleTime: 5 * 60_000 });
  const vibeOptions = vibesQuery.data ?? [];

  const show = (s: Exclude<FilterFocus, 'all'>) => focus === 'all' || focus === s;

  const toggleVibe = (slug: string) => {
    Haptics.selectionAsync();
    setDraft((d) => {
      const has = d.vibes.includes(slug);
      return { ...d, vibes: has ? d.vibes.filter((v) => v !== slug) : [...d.vibes, slug] };
    });
  };

  const isClean =
    draft.maxDistanceMiles === undefined &&
    draft.minPriceCents === undefined &&
    draft.maxPriceCents === undefined &&
    draft.minDiscountPct === undefined &&
    draft.minRating === undefined &&
    draft.vibes.length === 0 &&
    draft.sort === undefined;

  const title =
    focus === 'vibes' ? 'Vibe'
    : focus === 'price' ? 'Price'
    : focus === 'rating' ? 'Guest rating'
    : focus === 'sort' ? 'Sort'
    : 'Filters';

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(20,16,10,0.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: palette.surface.primary,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingTop: space[3],
            paddingBottom: insets.bottom + space[3],
            maxHeight: '85%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border.default, marginBottom: space[3] }} />

          <Stack direction="row" justify="space-between" align="center" style={{ paddingHorizontal: space[5], marginBottom: space[4] }}>
            <Text variant="display-sm" tone="primary" weight="medium">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text variant="body-md" tone="secondary" weight="medium">Done</Text>
            </Pressable>
          </Stack>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: space[6] }}
            showsVerticalScrollIndicator={false}
          >
            <Stack gap={6}>
              {show('vibes') ? (
                <Section title="Vibe" helper="The feel of the spa — pick any.">
                  <ChipRow>
                    {vibeOptions.map((v) => (
                      <Chip
                        key={v.slug}
                        label={`${v.icon} ${v.label}`}
                        active={draft.vibes.includes(v.slug)}
                        onPress={() => toggleVibe(v.slug)}
                      />
                    ))}
                  </ChipRow>
                </Section>
              ) : null}

              {show('price') ? (
                <Section title="Price" helper="Cheapest option at each spa.">
                  <ChipRow>
                    {PRICE_OPTS.map((opt) => (
                      <Chip
                        key={opt.label}
                        label={opt.label}
                        active={draft.minPriceCents === opt.min && draft.maxPriceCents === opt.max}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraft((d) => ({ ...d, minPriceCents: opt.min, maxPriceCents: opt.max }));
                        }}
                      />
                    ))}
                  </ChipRow>
                </Section>
              ) : null}

              {show('rating') ? (
                <Section title="Guest rating" helper="Combined Gloē + Google rating.">
                  <ChipRow>
                    {RATING_OPTS.map((opt) => (
                      <Chip
                        key={opt.label}
                        label={opt.label}
                        active={draft.minRating === opt.value}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraft((d) => ({ ...d, minRating: opt.value }));
                        }}
                      />
                    ))}
                  </ChipRow>
                </Section>
              ) : null}

              {show('sort') ? (
                <Section title="Sort" helper="How results are ordered.">
                  <ChipRow>
                    {SORT_OPTS.map((opt) => (
                      <Chip
                        key={opt.label}
                        label={opt.label}
                        active={draft.sort === opt.value}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDraft((d) => ({ ...d, sort: opt.value }));
                        }}
                      />
                    ))}
                  </ChipRow>
                </Section>
              ) : null}
            </Stack>
          </ScrollView>

          <Stack direction="row" gap={3} style={{ paddingHorizontal: space[5], paddingTop: space[3], borderTopWidth: 1, borderTopColor: palette.border.subtle }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Clear all"
                variant="secondary"
                size="lg"
                fullWidth
                disabled={isClean}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDraft({ ...EMPTY_MAP_FILTERS });
                }}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                label="Show results"
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onApply(draft);
                  onClose();
                }}
              />
            </View>
          </Stack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Stack gap={1}>
        <Text variant="body-md" tone="primary" weight="semibold">{title}</Text>
        <Text variant="caption" tone="tertiary">{helper}</Text>
      </Stack>
      {children}
    </Stack>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { color: palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space[4],
        paddingVertical: space[2],
        borderRadius: radius.pill,
        backgroundColor: active ? palette.text.primary : palette.surface.elevated,
        borderWidth: 1,
        borderColor: active ? palette.text.primary : palette.border.default,
      }}
    >
      <Text variant="body-sm" weight="semibold" tone={active ? 'inverse' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}
