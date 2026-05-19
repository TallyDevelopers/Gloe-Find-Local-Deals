export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface NamedLocation {
  /** Display name, e.g. "San Diego, CA" or "92037" */
  label: string;
  coords: Coordinates;
  /** Optional administrative info from reverse geocoding. */
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export type LocationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'restricted';

export interface GeocodeQuery {
  query: string;
}

/**
 * The interface the app talks to. Implementations may use Expo's geocoder,
 * Apple MapKit, Mapbox, etc. — screens only know about this shape.
 */
export interface LocationProvider {
  getPermissionStatus(): Promise<LocationPermissionStatus>;
  requestPermission(): Promise<LocationPermissionStatus>;
  getCurrentPosition(): Promise<Coordinates>;
  geocode(query: GeocodeQuery): Promise<NamedLocation[]>;
  reverseGeocode(coords: Coordinates): Promise<NamedLocation | null>;
}
