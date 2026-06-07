import { Input, Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../icon/Icon';
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
 * Bottom sheet for changing the browse location. Three ways in: free-text
 * address/city search (geocoded on submit), "Use my current location" (GPS),
 * and a curated list of popular markets.
 */
export function LocationPickerSheet({ open, onClose }: LocationPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const { location, setLocation, requestLocation } = useSelectedLocation();
  const translateY = useRef(new Animated.Value(800)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Free-text address / city search. Geocoded on submit via the OS geocoder
  // (no API key, no extra dep) — turns "Austin TX" or a street address into
  // coords + a clean label, then sets it like any picked city.
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
    Keyboard.dismiss();
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 800,
        useNativeDriver: true,
        damping: 28,
        stiffness: 280,
      }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      // Reset the search field so reopening starts clean.
      setQuery('');
      setSearchError(null);
      onClose();
    });
  };

  const handlePick = (loc: SelectedLocation) => {
    setLocation(loc);
    close();
  };

  // Geocode the typed address/city → coords, build a "City, ST" label from the
  // reverse-geocode, and select it. Errors stay inline so the city list below
  // remains a working fallback.
  const handleSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError(null);
    try {
      const [hit] = await Location.geocodeAsync(q);
      if (!hit) {
        setSearchError("We couldn't find that place. Try a city or full address.");
        return;
      }
      // Reverse-geocode for a clean, human label ("San Diego, CA") instead of
      // echoing the raw query. Fall back to the typed text if it comes back empty.
      let label = q;
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: hit.latitude,
          longitude: hit.longitude,
        });
        const city = place?.city ?? place?.subregion ?? place?.district;
        const region = place?.region; // state/province
        if (city && region) label = `${city}, ${region}`;
        else if (city) label = city;
        else if (region) label = region;
      } catch {
        // Keep the typed query as the label.
      }
      handlePick({ label, latitude: hit.latitude, longitude: hit.longitude });
    } catch {
      setSearchError("We couldn't search right now. Try again or pick a city.");
    } finally {
      setSearching(false);
    }
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
            backgroundColor: palette.surface.overlay,
            opacity: overlayOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: palette.surface.primary,
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
              backgroundColor: palette.neutral[300],
              marginBottom: space[6],
            }}
          />

          <Stack gap={6}>
            <Stack gap={2}>
              <Text variant="display-sm" tone="primary" weight="medium">
                Browse location
              </Text>
              <Text variant="body-md" tone="secondary">
                Enter an address, search a city, or pick one below.
              </Text>
            </Stack>

            {/* Address / city search — type anything and we geocode it on submit.
                The keyboard "Search" key and the row's own submit both fire it. */}
            <Input
              placeholder="Enter an address or city"
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                if (searchError) setSearchError(null);
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="words"
              autoCorrect={false}
              error={searchError ?? undefined}
              leftIcon={<Icon name="search" size={18} color={palette.text.tertiary} strokeWidth={2} />}
              rightIcon={
                searching ? (
                  <ActivityIndicator size="small" color={palette.brand[500]} />
                ) : query.trim() ? (
                  <Pressable onPress={handleSearch} hitSlop={8}>
                    <Icon name="arrowUpRight" size={18} color={palette.brand[600]} strokeWidth={2.25} />
                  </Pressable>
                ) : undefined
              }
            />

            {/* Use my location — GPS, the top option. Picks the device fix and
                closes; falls through silently if permission is blocked (the
                city list below is the fallback). */}
            <Pressable
              onPress={async () => {
                const ok = await requestLocation();
                if (ok) close();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                paddingVertical: space[4],
                paddingHorizontal: space[5],
                backgroundColor: palette.brand[100],
                borderRadius: radius.lg,
              }}
            >
              <Icon name="pin" size={18} color={palette.brand[700]} strokeWidth={2.25} />
              <Text variant="body-md" weight="semibold" style={{ color: palette.brand[800] }}>
                Use my current location
              </Text>
            </Pressable>

            <Stack gap={2}>
              <Text variant="label" tone="tertiary">
                POPULAR MARKETS
              </Text>
              <View
                style={{
                  backgroundColor: palette.surface.elevated,
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
                        borderBottomColor: palette.border.subtle,
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
          </Stack>
        </Animated.View>
      </View>
    </Modal>
  );
}
