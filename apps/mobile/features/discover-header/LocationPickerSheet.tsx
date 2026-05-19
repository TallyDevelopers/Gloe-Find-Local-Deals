import { Stack, Text, color, radius, space } from '@gloe/ui';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  POPULAR_CITIES,
  useSelectedLocation,
  type SelectedLocation,
} from './SelectedLocationProvider';

interface LocationPickerSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Bottom sheet for changing the browse location. v0: popular cities only.
 * "Use my location" and city search will be added in the real GPS patch.
 */
export function LocationPickerSheet({ open, onClose }: LocationPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { location, setLocation } = useSelectedLocation();
  const translateY = useRef(new Animated.Value(800)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 280,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [open, translateY, overlayOpacity]);

  const close = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 800,
        useNativeDriver: true,
        damping: 28,
        stiffness: 280,
      }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const handlePick = (loc: SelectedLocation) => {
    setLocation(loc);
    close();
  };

  return (
    <Modal transparent animationType="none" visible={open} onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: color.surface.overlay,
            opacity: overlayOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: color.surface.primary,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingTop: space[4],
            paddingHorizontal: space[6],
            paddingBottom: insets.bottom + space[6],
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: color.neutral[300],
              marginBottom: space[6],
            }}
          />

          <Stack gap={6}>
            <Stack gap={2}>
              <Text variant="display-sm" tone="primary" weight="medium">
                Browse location
              </Text>
              <Text variant="body-md" tone="secondary">
                Pick a city to see deals nearby.
              </Text>
            </Stack>

            <Stack gap={2}>
              <Text variant="label" tone="tertiary">
                POPULAR MARKETS
              </Text>
              <View
                style={{
                  backgroundColor: color.surface.elevated,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                }}
              >
                {POPULAR_CITIES.map((city, i) => {
                  const isActive = city.label === location.label;
                  return (
                    <Pressable
                      key={city.label}
                      onPress={() => handlePick(city)}
                      style={{
                        paddingVertical: space[4],
                        paddingHorizontal: space[5],
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottomWidth: i === POPULAR_CITIES.length - 1 ? 0 : 1,
                        borderBottomColor: color.border.subtle,
                      }}
                    >
                      <Text
                        variant="body-md"
                        tone="primary"
                        weight={isActive ? 'semibold' : 'medium'}
                      >
                        {city.label}
                      </Text>
                      {isActive ? (
                        <Text variant="body-md" tone="brand" weight="semibold">
                          ✓
                        </Text>
                      ) : (
                        <Text variant="body-md" tone="tertiary">
                          ›
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Stack>

            <Text variant="caption" tone="tertiary" align="center">
              Use my location + search by city coming soon.
            </Text>
          </Stack>
        </Animated.View>
      </View>
    </Modal>
  );
}
