import { Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useImperativeHandle, useRef, forwardRef } from 'react';
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

export interface MapBrowseSheetHandle {
  /** Snap the sheet back to the collapsed (cards) detent — e.g. when a pin is tapped. */
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
 * Three-detent browse sheet over the map (the ResortPass interaction):
 *
 *   ▸ collapsed  — map + swipeable cards. Swipe a card → its pin darkens.
 *   ▸ mid        — cards fade away, sheet rises to ~55% and the vertical
 *                  listing appears with some of the map still showing above.
 *   ▸ full       — swipe up again: map gone, straight scrollable listing with
 *                  the header's filters pinned above it.
 *
 * Driven by one Animated.Value (`top` = the sheet's distance from the top of
 * the screen). Dragging the grabber animates `top` between the three snap
 * points; card opacity / list opacity interpolate off it so the transition
 * between "cards" and "list" is a smooth crossfade, not a hard swap. Built on
 * RN core Animated + PanResponder — no gesture/sheet dependency.
 */
export const MapBrowseSheet = forwardRef<MapBrowseSheetHandle, MapBrowseSheetProps>(function MapBrowseSheet(
  {
    spas, isLoading, cardWidth, cardSnap, cardGutter, listRef, onCardSettle,
    savedIds, onToggleSave, bottomInset, headerBottom,
  },
  ref,
) {
  const { color: palette } = useTheme();

  // Snap points as distances from the top of the screen (smaller = higher up).
  const COLLAPSED_PEEK = 116 + 64 + bottomInset; // grabber + count + one card row
  const SNAP_COLLAPSED = SCREEN_H - COLLAPSED_PEEK;
  const SNAP_MID = Math.round(SCREEN_H * 0.45);
  const SNAP_FULL = headerBottom;

  const top = useRef(new Animated.Value(SNAP_COLLAPSED)).current;
  const currentSnap = useRef(SNAP_COLLAPSED);

  const snapTo = (to: number) => {
    currentSnap.current = to;
    Animated.spring(top, { toValue: to, useNativeDriver: false, bounciness: 1, speed: 13 }).start();
  };

  useImperativeHandle(ref, () => ({ collapse: () => snapTo(SNAP_COLLAPSED) }), []);

  // Pick the nearest snap after a drag, biased by drag direction/velocity.
  const settle = (dragEndY: number, vy: number) => {
    const points = [SNAP_FULL, SNAP_MID, SNAP_COLLAPSED];
    // Velocity assist: a firm flick jumps a detent in that direction.
    if (vy < -0.6) return snapTo(SNAP_FULL === currentSnap.current ? SNAP_FULL : nextUp(points, currentSnap.current));
    if (vy > 0.6) return snapTo(nextDown(points, currentSnap.current));
    // Otherwise snap to whichever point the sheet's top is closest to.
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

  // Crossfade: cards live in the collapsed band; the list takes over above mid.
  const cardOpacity = top.interpolate({
    inputRange: [SNAP_MID, (SNAP_MID + SNAP_COLLAPSED) / 2, SNAP_COLLAPSED],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const listOpacity = top.interpolate({
    inputRange: [SNAP_MID, (SNAP_MID + SNAP_COLLAPSED) / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const countLabel = isLoading
    ? 'Finding spas…'
    : `${spas.length} ${spas.length === 1 ? 'spa' : 'spas'} found`;

  return (
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
      {/* Grabber + count — the drag handle. Tapping it cycles up a detent. */}
      <View {...pan.panHandlers}>
        <View style={{ alignItems: 'center', paddingTop: space[2] }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border.default }} />
        </View>
        <Pressable
          onPress={() =>
            snapTo(currentSnap.current === SNAP_COLLAPSED ? SNAP_MID : currentSnap.current === SNAP_MID ? SNAP_FULL : SNAP_COLLAPSED)
          }
          style={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] }}
        >
          <Text variant="body-md" tone="primary" weight="semibold">
            {countLabel}
          </Text>
        </Pressable>
      </View>

      {/* Collapsed: swipeable carousel. Fades out as the sheet rises past mid. */}
      <Animated.View
        pointerEvents="box-none"
        style={{ opacity: cardOpacity, position: 'absolute', left: 0, right: 0, top: 64 }}
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

      {/* Mid + full: the full vertical browse list, fades in above mid. */}
      <Animated.View style={{ opacity: listOpacity, flex: 1, marginTop: 4 }}>
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
