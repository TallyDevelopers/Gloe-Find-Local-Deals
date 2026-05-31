import { trpc } from '@gloe/api-client';
import { Stack, Text, radius, space, useTheme } from '@gloe/ui';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

import { CachedImage } from '../image/CachedImage';

interface RedemptionMapProps {
  redemption: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    mapUrl: string | null;
  };
  vendorName: string;
}

type Mode = 'driving' | 'walking';

/**
 * Where-you'll-go map. Shows the cached static image by default (cheap, no
 * per-view Google cost). On "Calculate distance" it asks for the customer's
 * location and swaps in a live, routed react-native-map with drive + (if close)
 * walk times.
 */
export function RedemptionMap({ redemption, vendorName }: RedemptionMapProps) {
  const { color: palette } = useTheme();
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dest =
    redemption.latitude != null && redemption.longitude != null
      ? { lat: redemption.latitude, lng: redemption.longitude }
      : null;

  const driving = trpc.maps.directions.useQuery(
    { originLat: origin?.lat ?? 0, originLng: origin?.lng ?? 0, destLat: dest?.lat ?? 0, destLng: dest?.lng ?? 0, mode: 'driving' },
    { enabled: origin != null && dest != null, staleTime: 300_000 },
  );
  const isWalkable = driving.data?.found ? driving.data.distanceMeters < 1609 : false;
  const walking = trpc.maps.directions.useQuery(
    { originLat: origin?.lat ?? 0, originLng: origin?.lng ?? 0, destLat: dest?.lat ?? 0, destLng: dest?.lng ?? 0, mode: 'walking' },
    { enabled: origin != null && dest != null && isWalkable, staleTime: 300_000 },
  );

  if (!dest) return null;

  const calculate = async () => {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Allow location access to calculate distance.');
        return;
      }
      // Use the last cached fix if it's reasonably fresh — instant, and plenty
      // accurate for "how far away am I". Only wait on a live GPS read if none.
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      const pos =
        cached ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError("Couldn't get your location. Try again.");
    } finally {
      setLocating(false);
    }
  };

  // One tap → Apple Maps. No chooser, no permission dance, no fallback prompts.
  // iOS users have Apple Maps. Period. (Android falls through to web Google Maps.)
  const openInMaps = async () => {
    const label = encodeURIComponent(vendorName);
    const { lat, lng } = dest;
    setError(null);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    try {
      await Linking.openURL(url);
    } catch {
      setError("Couldn't open Maps.");
    }
  };

  const driveResult = driving.data?.found ? driving.data : null;
  const walkText = isWalkable && walking.data?.found ? walking.data.durationText : null;
  const routeCoords =
    origin && driveResult?.polyline ? decodePolyline(driveResult.polyline) : null;

  return (
    <Stack gap={3}>
      <View style={{ borderRadius: radius.lg, overflow: 'hidden', height: 180, backgroundColor: palette.surface.secondary }}>
        {origin ? (
          <MapView
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            region={regionFor(origin, dest)}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} title={vendorName} pinColor={palette.brand[500]} />
            <Marker coordinate={{ latitude: origin.lat, longitude: origin.lng }} title="You" pinColor="#1a73e8" />
            {routeCoords ? (
              <Polyline coordinates={routeCoords} strokeColor="#1a73e8" strokeWidth={5} />
            ) : null}
          </MapView>
        ) : redemption.mapUrl ? (
          <CachedImage uri={redemption.mapUrl} style={{ flex: 1 }} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="body-sm" tone="tertiary">Map unavailable</Text>
          </View>
        )}
      </View>

      {redemption.address ? (
        <Text variant="body-md" tone="secondary">{redemption.address}</Text>
      ) : null}

      {driveResult ? (
        <View
          style={{
            backgroundColor: palette.surface.elevated,
            borderRadius: radius.md,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
          }}
        >
          <Stack direction="row" justify="space-between" align="center">
            <Text variant="body-md" tone="primary" weight="semibold">{driveResult.distanceText} away</Text>
            <Text variant="body-md" tone="brand" weight="semibold">
              {driveResult.durationText} drive{walkText ? ` · ${walkText} walk` : ''}
            </Text>
          </Stack>
        </View>
      ) : (
        <Pressable
          onPress={calculate}
          disabled={locating || driving.isFetching}
          style={{
            borderWidth: 1,
            borderColor: palette.border.default,
            borderRadius: radius.pill,
            paddingVertical: space[3],
            alignItems: 'center',
          }}
        >
          <Text variant="body-md" tone="brand" weight="semibold">
            {locating || driving.isFetching ? 'Calculating…' : '📍 Calculate distance'}
          </Text>
        </Pressable>
      )}

      {error ? <Text variant="body-sm" tone="error">{error}</Text> : null}

      <Pressable onPress={openInMaps} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Text variant="body-sm" tone="link" weight="semibold">Open in Maps →</Text>
      </Pressable>
    </Stack>
  );
}

/** Region that frames both points with padding. */
function regionFor(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const midLat = (a.lat + b.lat) / 2;
  const midLng = (a.lng + b.lng) / 2;
  const latDelta = Math.max(Math.abs(a.lat - b.lat) * 1.6, 0.02);
  const lngDelta = Math.max(Math.abs(a.lng - b.lng) * 1.6, 0.02);
  return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

/** Decodes a Google encoded polyline into lat/lng coordinates. */
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}
