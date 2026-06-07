import { trpc } from '@gloe/api-client';
import { Input, Stack, Text, radius, space, useTheme } from '@gloe/ui';
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
 * Bottom sheet for changing the browse location. Three ways in: a live
 * autocompleting address/city search (Google Places via our `geocode` router),
 * "Use my current location" (GPS), and a curated list of popular markets.
 */
export function LocationPickerSheet({ open, onClose }: LocationPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { color: palette } = useTheme();
  const { location, setLocation, requestLocation } = useSelectedLocation();
  const utils = trpc.useUtils();
  const translateY = useRef(new Animated.Value(800)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Address / city search. As you type, we debounce the input and hit Google
  // Places autocomplete (server-proxied, key stays on the API) so suggestions
  // populate live. Tapping a suggestion resolves it to coords via placeDetails.
  const [query, setQuery] = useState('');
  // The debounced value that actually drives the autocomplete query — keeps us
  // from firing a request on every keystroke.
  const [debounced, setDebounced] = useState('');
  // True while resolving a tapped suggestion to coords (placeDetails).
  const [resolving, setResolving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounce: 250ms after the last keystroke, promote query → debounced.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Live suggestions. `types: 'geocode'` so plain city names autocomplete
  // alongside full street addresses. Min length matches the router (3).
  const suggestQuery = trpc.geocode.autocomplete.useQuery(
    { query: debounced, types: 'geocode' },
    { enabled: debounced.length >= 3, staleTime: 60_000, retry: false },
  );
  const suggestions = suggestQuery.data ?? [];

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
      setDebounced('');
      setSearchError(null);
      onClose();
    });
  };

  const handlePick = (loc: SelectedLocation) => {
    setLocation(loc);
    close();
  };

  // A tapped suggestion → resolve its place_id to coords + a clean "City, ST"
  // label via placeDetails, then select it. Errors stay inline so the popular-
  // cities list below remains a working fallback.
  const pickSuggestion = async (placeId: string) => {
    if (resolving) return;
    Keyboard.dismiss();
    setResolving(true);
    setSearchError(null);
    try {
      const place = await utils.geocode.placeDetails.fetch({ placeId });
      const label =
        place.city && place.region
          ? `${place.city}, ${place.region}`
          : place.city || place.region || place.formattedAddress;
      handlePick({ label, latitude: place.latitude, longitude: place.longitude });
    } catch {
      setSearchError("We couldn't load that place. Try another or pick a city.");
    } finally {
      setResolving(false);
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

            {/* Address / city search — suggestions populate live as you type
                (Google Places autocomplete via our geocode router). */}
            <Stack gap={3}>
              <Input
                placeholder="Enter an address or city"
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  if (searchError) setSearchError(null);
                }}
                returnKeyType="search"
                autoCapitalize="words"
                autoCorrect={false}
                error={searchError ?? undefined}
                leftIcon={<Icon name="search" size={18} color={palette.text.tertiary} strokeWidth={2} />}
                rightIcon={
                  resolving || (suggestQuery.isFetching && debounced.length >= 3) ? (
                    <ActivityIndicator size="small" color={palette.brand[500]} />
                  ) : undefined
                }
              />

              {/* Live suggestions list — shows once the query is long enough.
                  Tapping one resolves it to coords and sets the location. */}
              {debounced.length >= 3 ? (
                <View
                  style={{
                    backgroundColor: palette.surface.elevated,
                    borderRadius: radius.lg,
                    overflow: 'hidden',
                  }}
                >
                  {suggestions.length > 0 ? (
                    suggestions.map((s, i) => (
                      <Pressable
                        key={s.placeId}
                        onPress={() => pickSuggestion(s.placeId)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space[3],
                          paddingVertical: space[4],
                          paddingHorizontal: space[5],
                          borderBottomWidth: i === suggestions.length - 1 ? 0 : 1,
                          borderBottomColor: palette.border.subtle,
                        }}
                      >
                        <Icon name="pin" size={16} color={palette.text.tertiary} strokeWidth={2.25} />
                        <Text variant="body-md" tone="primary" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                          {s.description}
                        </Text>
                      </Pressable>
                    ))
                  ) : suggestQuery.isFetching ? (
                    <View style={{ paddingVertical: space[5], alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={palette.brand[500]} />
                    </View>
                  ) : (
                    <View style={{ paddingVertical: space[5], paddingHorizontal: space[5] }}>
                      <Text variant="body-md" tone="secondary">
                        No matches. Try a city or full address.
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}
            </Stack>

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
