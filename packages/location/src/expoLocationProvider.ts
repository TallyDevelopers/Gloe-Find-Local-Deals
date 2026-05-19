import * as Location from 'expo-location';

import type {
  Coordinates,
  GeocodeQuery,
  LocationPermissionStatus,
  LocationProvider,
  NamedLocation,
} from './types';

/**
 * LocationProvider implementation backed by expo-location.
 * Uses Apple's geocoder on iOS and Google's on Android — no API keys needed.
 */
export const expoLocationProvider: LocationProvider = {
  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return mapStatus(status);
  },

  async requestPermission(): Promise<LocationPermissionStatus> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return mapStatus(status);
  },

  async getCurrentPosition(): Promise<Coordinates> {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  },

  async geocode({ query }: GeocodeQuery): Promise<NamedLocation[]> {
    const results = await Location.geocodeAsync(query);
    return results.map((r) => ({
      label: query,
      coords: { latitude: r.latitude, longitude: r.longitude },
    }));
  },

  async reverseGeocode(coords: Coordinates): Promise<NamedLocation | null> {
    const results = await Location.reverseGeocodeAsync(coords);
    const first = results[0];
    if (!first) return null;
    const city = first.city ?? first.subregion ?? undefined;
    const region = first.region ?? undefined;
    const labelParts = [city, region].filter(Boolean);
    return {
      label: labelParts.join(', ') || first.postalCode || 'Current location',
      coords,
      city,
      region,
      postalCode: first.postalCode ?? undefined,
      country: first.country ?? undefined,
    };
  },
};

function mapStatus(s: Location.PermissionStatus): LocationPermissionStatus {
  if (s === Location.PermissionStatus.GRANTED) return 'granted';
  if (s === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}
