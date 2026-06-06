import { Stack, Text, radius, shadow, space, useTheme } from '@gloe/ui';
import { useRef } from 'react';
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

interface MapBrowseSheetProps {
  spas: SpaPin[];
  isLoading: boolean;
  /** Card geometry, shared with the screen so pins stay in sync. */
  cardWidth: number;
  cardSnap: number;
  cardGutter: number;
  listRef: React.Ref<FlatList<SpaPin>>;
  onCardSettle: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  savedIds: Set<string>;
  onToggleSave: (dealId: string) => void;
  /** Distance from the bottom of the screen the collapsed sheet should sit at. */
  bottomInset: number;
}

/**
 * Bottom panel over the map. Two detents:
 *  - collapsed: a grabber + "N spas found" header + the swipeable card row
 *    (pins stay synced as you swipe — see the screen's onCardSettle).
 *  - expanded: drag up (or tap the header) and it grows into a full scrollable
 *    list of every spa, the cards giving way to a vertical browse view.
 *
 * Built on RN core Animated + PanResponder — no sheet/gesture dependency. The
 * expanded list reuses MapDealCard at full width so a spa looks the same whether
 * you're swiping the carousel or scrolling the list.
 */
export function MapBrowseSheet({
  spas,
  isLoading,
  cardWidth,
  cardSnap,
  cardGutter,
  listRef,
  onCardSettle,
  savedIds,
  onToggleSave,
  bottomInset,
}: MapBrowseSheetProps) {
  const { color: palette } = useTheme();

  // Collapsed height: grabber + header + one card row + padding. Expanded:
  // most of the screen, leaving the top category bar peeking through.
  const COLLAPSED_H = 116 + 64 + bottomInset;
  const EXPANDED_H = SCREEN_H * 0.82;

  // `expand` animates the panel height between the two detents (0 → collapsed,
  // 1 → expanded). We drive a height interpolation off it.
  const expand = useRef(new Animated.Value(0)).current;
  const expandedRef = useRef(false);

  const snapTo = (toExpanded: boolean) => {
    expandedRef.current = toExpanded;
    Animated.spring(expand, {
      toValue: toExpanded ? 1 : 0,
      useNativeDriver: false,
      bounciness: 2,
      speed: 14,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // Only claim clearly-vertical drags so horizontal card swipes still work.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        // Up = expand, down = collapse, with a velocity assist.
        if (g.dy < -40 || g.vy < -0.5) snapTo(true);
        else if (g.dy > 40 || g.vy > 0.5) snapTo(false);
        else snapTo(expandedRef.current);
      },
    }),
  ).current;

  const height = expand.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_H, EXPANDED_H],
  });
  // Fade the carousel out / the list in as the sheet expands.
  const carouselOpacity = expand.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const listOpacity = expand.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const countLabel = isLoading
    ? 'Finding spas…'
    : `${spas.length} ${spas.length === 1 ? 'spa' : 'spas'} found`;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        backgroundColor: palette.surface.primary,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        ...shadow.lg,
        overflow: 'hidden',
      }}
    >
      {/* Grabber + count header — the drag handle and tap-to-toggle target. */}
      <Pressable onPress={() => snapTo(!expandedRef.current)} {...pan.panHandlers}>
        <View style={{ alignItems: 'center', paddingTop: space[2] }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.border.default }} />
        </View>
        <View style={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] }}>
          <Text variant="body-md" tone="primary" weight="semibold">
            {countLabel}
          </Text>
        </View>
      </Pressable>

      {/* Collapsed: swipeable carousel. Fades out as the sheet expands. */}
      <Animated.View
        pointerEvents="box-none"
        style={{ opacity: carouselOpacity, position: 'absolute', left: 0, right: 0, top: 64 }}
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

      {/* Expanded: full vertical browse list. Fades in; only interactive when up. */}
      <Animated.View
        pointerEvents={expandedRef.current ? 'auto' : 'none'}
        style={{ opacity: listOpacity, flex: 1, marginTop: 8 }}
      >
        <FlatList
          data={spas}
          keyExtractor={(s) => `list-${s.vendorId}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: bottomInset + space[4], gap: space[3] }}
          renderItem={({ item }) => (
            <Stack>
              <MapDealCard
                spa={item}
                width={cardWidth}
                isSaved={savedIds.has(item.headline.id)}
                onSave={() => onToggleSave(item.headline.id)}
              />
            </Stack>
          )}
        />
      </Animated.View>
    </Animated.View>
  );
}
