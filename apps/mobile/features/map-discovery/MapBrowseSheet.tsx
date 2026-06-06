import { Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { MapDealCard } from './MapDealCard';
import type { SpaPin } from './spaGrouping';

const { height: SCREEN_H } = Dimensions.get('window');

const CARD_ROW_H = 116; // MapDealCard image height — the floating card row's height

export interface MapBrowseSheetHandle {
  /** Snap the sheet back to the collapsed detent (cards floating over the map). */
  collapse: () => void;
}

interface MapBrowseSheetProps {
  spas: SpaPin[];
  isLoading: boolean;
  cardWidth: number;
  cardSnap: number;
  cardGutter: number;
  listRef: React.Ref<FlatList<SpaPin>>;
  onCardSettle: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  savedIds: Set<string>;
  onToggleSave: (dealId: string) => void;
  /** Safe-area bottom inset. */
  bottomInset: number;
  /** Y (from top of screen) where the static header ends — the full detent stops here. */
  headerBottom: number;
}

/**
 * The ResortPass bottom interaction, three detents:
 *
 *   ▸ collapsed — a thin "N found" sheet sits at the very bottom; the swipeable
 *                 cards FLOAT over the map just above it (their own transparent
 *                 layer — not inside the sheet).
 *   ▸ mid       — drag the sheet up: the floating cards fade away and the sheet
 *                 grows into a vertical listing, with some of the map still above.
 *   ▸ full      — drag again: map gone, full scrollable listing under the pinned
 *                 header.
 *
 * Two layers, one driver. A single Animated.Value (`top` = the sheet's distance
 * from the top of the screen) animates between three snap points; the floating
 * card row's opacity is interpolated off it so the cards crossfade out exactly
 * as the sheet rises. RN core Animated + PanResponder — no extra dependency.
 */
export const MapBrowseSheet = forwardRef<MapBrowseSheetHandle, MapBrowseSheetProps>(function MapBrowseSheet(
  {
    spas, isLoading, cardWidth, cardSnap, cardGutter, listRef, onCardSettle,
    savedIds, onToggleSave, bottomInset, headerBottom,
  },
  ref,
) {
  const { color: palette } = useTheme();

  // Sheet header (grabber + count) height — the only part of the sheet visible
  // when collapsed. The cards float ABOVE this.
  const SHEET_HEADER_H = 56;
  // Snap points = the sheet's top edge measured from the top of the screen.
  const SNAP_COLLAPSED = SCREEN_H - SHEET_HEADER_H - bottomInset;
  const SNAP_MID = Math.round(SCREEN_H * 0.45);
  const SNAP_FULL = headerBottom;

  const top = useRef(new Animated.Value(SNAP_COLLAPSED)).current;
  const currentSnap = useRef(SNAP_COLLAPSED);
  // Whether we're at the collapsed detent — gates the floating cards' touches
  // so the (faded-out) carousel can't grab swipes meant for the list.
  const [collapsed, setCollapsed] = useState(true);

  const snapTo = (to: number) => {
    currentSnap.current = to;
    setCollapsed(to === SNAP_COLLAPSED);
    Animated.spring(top, { toValue: to, useNativeDriver: false, bounciness: 1, speed: 13 }).start();
  };

  useImperativeHandle(ref, () => ({ collapse: () => snapTo(SNAP_COLLAPSED) }), []);

  const settle = (dragEndY: number, vy: number) => {
    const points = [SNAP_FULL, SNAP_MID, SNAP_COLLAPSED];
    if (vy < -0.6) return snapTo(nextUp(points, currentSnap.current));
    if (vy > 0.6) return snapTo(nextDown(points, currentSnap.current));
    const nearest = points.reduce((a, b) => (Math.abs(b - dragEndY) < Math.abs(a - dragEndY) ? b : a));
    snapTo(nearest);
  };

  const dragStart = useRef(SNAP_COLLAPSED);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        dragStart.current = currentSnap.current;
        top.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        const next = Math.min(SNAP_COLLAPSED, Math.max(SNAP_FULL, dragStart.current + g.dy));
        top.setValue(next);
      },
      onPanResponderRelease: (_e, g) => settle(dragStart.current + g.dy, g.vy),
    }),
  ).current;

  // The floating cards are fully visible only at the collapsed detent; they
  // fade out over the first part of the drag toward mid.
  const cardOpacity = top.interpolate({
    inputRange: [(SNAP_MID + SNAP_COLLAPSED) / 2, SNAP_COLLAPSED],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // The vertical list inside the sheet fades in as we approach/pass mid.
  const listOpacity = top.interpolate({
    inputRange: [SNAP_MID, (SNAP_MID + SNAP_COLLAPSED) / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const countLabel = isLoading
    ? 'Finding spas…'
    : `${spas.length} ${spas.length === 1 ? 'spa' : 'spas'} found`;

  return (
    <>
      {/* ── Floating swipeable cards — their own layer OVER the map, sitting
             just above the collapsed sheet header. Fades out as it rises. ── */}
      <Animated.View
        pointerEvents={collapsed ? 'box-none' : 'none'}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: SHEET_HEADER_H + bottomInset + space[2],
          opacity: cardOpacity,
        }}
      >
        {spas.length > 0 ? (
          <FlatList
            ref={listRef}
            data={spas}
            keyExtractor={(s) => s.vendorId}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardSnap}
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={onCardSettle}
            contentContainerStyle={{ paddingHorizontal: cardGutter, gap: space[3] }}
            style={{ height: CARD_ROW_H }}
            renderItem={({ item }) => (
              <MapDealCard
                spa={item}
                width={cardWidth}
                isSaved={savedIds.has(item.headline.id)}
                onSave={() => onToggleSave(item.headline.id)}
              />
            )}
          />
        ) : null}
      </Animated.View>

      {/* ── The sheet itself: grabber + "N found" + (mid/full) the list ──── */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top,
          bottom: 0,
          backgroundColor: palette.surface.primary,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          ...shadow.lg,
          overflow: 'hidden',
        }}
      >
        {/* Grabber + count — the drag handle. Tapping cycles up a detent. */}
        <View {...pan.panHandlers}>
          <View style={{ alignItems: 'center', paddingTop: space[2] }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border.default }} />
          </View>
          <Pressable
            onPress={() =>
              snapTo(currentSnap.current === SNAP_COLLAPSED ? SNAP_MID : currentSnap.current === SNAP_MID ? SNAP_FULL : SNAP_COLLAPSED)
            }
            style={{ paddingHorizontal: space[5], paddingTop: space[1], paddingBottom: space[2] }}
          >
            <Text variant="body-md" tone="primary" weight="semibold">
              {countLabel}
            </Text>
          </Pressable>
        </View>

        {/* Mid + full: the full vertical browse list, fades in above mid. */}
        <Animated.View style={{ opacity: listOpacity, flex: 1 }}>
          <FlatList
            data={spas}
            keyExtractor={(s) => `list-${s.vendorId}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: bottomInset + space[6], gap: space[3] }}
            renderItem={({ item }) => (
              <MapDealCard
                spa={item}
                width={cardWidth}
                isSaved={savedIds.has(item.headline.id)}
                onSave={() => onToggleSave(item.headline.id)}
              />
            )}
          />
        </Animated.View>
      </Animated.View>
    </>
  );
});

/** Next snap higher (smaller top value) than the current one. */
function nextUp(points: number[], cur: number): number {
  const higher = points.filter((p) => p < cur);
  return higher.length ? Math.max(...higher) : cur;
}

/** Next snap lower (larger top value) than the current one. */
function nextDown(points: number[], cur: number): number {
  const lower = points.filter((p) => p > cur);
  return lower.length ? Math.min(...lower) : cur;
}
