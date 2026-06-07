/**
 * The single seam to Google Maps. Every Google Places / Maps / Directions call
 * goes through here — nothing else in the codebase reads GOOGLE_MAPS_API_KEY or
 * builds a maps.googleapis.com URL. Swapping providers or rotating the key is a
 * one-file change.
 */

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE = 'https://maps.googleapis.com/maps/api';

export class MapsNotConfiguredError extends Error {
  constructor() {
    super('Maps not configured');
    this.name = 'MapsNotConfiguredError';
  }
}

function key(): string {
  if (!GOOGLE_KEY) throw new MapsNotConfiguredError();
  return GOOGLE_KEY;
}

/** True if a maps key is present — lets callers degrade gracefully. */
export function isMapsConfigured(): boolean {
  return !!GOOGLE_KEY;
}

// ── Google response shapes (internal — callers see the mapped types below) ──
interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}
interface AutocompleteResponse {
  status: string;
  error_message?: string;
  predictions: { description: string; place_id: string }[];
}
interface PlaceDetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    place_id?: string;
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: AddressComponent[];
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    reviews?: {
      author_name: string;
      profile_photo_url?: string;
      rating: number;
      relative_time_description: string;
      text: string;
    }[];
  };
}
interface DirectionsResponse {
  status: string;
  error_message?: string;
  routes?: {
    overview_polyline: { points: string };
    legs: { distance: { text: string; value: number }; duration: { text: string; value: number } }[];
  }[];
}

function pick(components: AddressComponent[], type: string, useShort = false): string {
  const c = components.find((comp) => comp.types.includes(type));
  if (!c) return '';
  return useShort ? c.short_name : c.long_name;
}

// ── Public, mapped result types ──
export interface PlacePrediction {
  description: string;
  placeId: string;
}
export interface ResolvedPlace {
  placeId: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}
export type DirectionsResult =
  | { found: false }
  | {
      found: true;
      distanceText: string;
      distanceMeters: number;
      durationText: string;
      durationSeconds: number;
      polyline: string | null;
    };
export type PlaceReviewsResult =
  | { available: false }
  | {
      available: true;
      rating: number | null;
      totalRatings: number | null;
      attributionUrl: string | null;
      reviews: {
        authorName: string;
        photoUrl: string | null;
        rating: number;
        relativeTime: string;
        text: string;
      }[];
    };

/**
 * Address type-ahead. Throws on a hard failure; returns [] for no matches.
 *
 * `types` defaults to 'address' (street addresses — the deal-creation use case).
 * Pass 'geocode' for the browse-location picker so plain city names ("Austin")
 * autocomplete alongside full addresses. See Google's place-autocomplete types.
 */
export async function autocompleteAddress(
  query: string,
  types: 'address' | 'geocode' = 'address',
): Promise<PlacePrediction[]> {
  const url = new URL(`${BASE}/place/autocomplete/json`);
  url.searchParams.set('input', query);
  url.searchParams.set('key', key());
  url.searchParams.set('components', 'country:us');
  url.searchParams.set('types', types);

  const res = await fetch(url);
  const data = (await res.json()) as AutocompleteResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message ?? data.status);
  }
  return data.predictions.map((p) => ({ description: p.description, placeId: p.place_id }));
}

interface FindPlaceResponse {
  status: string;
  error_message?: string;
  candidates?: { place_id: string }[];
}

/**
 * Resolve a business to its Google place_id from a free-text query (typically
 * "{business name}, {full address}"). Returns null when Google has no confident
 * match. Lets us auto-link a vendor for Google reviews from data we already
 * store — no manual Place ID lookup.
 */
export async function findPlaceId(query: string): Promise<string | null> {
  const url = new URL(`${BASE}/place/findplacefromtext/json`);
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id');
  url.searchParams.set('key', key());

  const res = await fetch(url);
  const data = (await res.json()) as FindPlaceResponse;
  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status !== 'OK') throw new Error(data.error_message ?? data.status);
  return data.candidates?.[0]?.place_id ?? null;
}

/** Resolve a place_id to full address parts + coordinates. Null if not found. */
export async function resolvePlace(placeId: string): Promise<ResolvedPlace | null> {
  const url = new URL(`${BASE}/place/details/json`);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('key', key());
  url.searchParams.set('fields', 'place_id,formatted_address,geometry,address_component');

  const res = await fetch(url);
  const data = (await res.json()) as PlaceDetailsResponse;
  if (data.status !== 'OK' || !data.result) return null;
  const c = data.result.address_components;
  return {
    placeId: data.result.place_id ?? placeId,
    addressLine1: [pick(c, 'street_number'), pick(c, 'route')].filter(Boolean).join(' '),
    city: pick(c, 'locality') || pick(c, 'sublocality') || pick(c, 'administrative_area_level_2'),
    region: pick(c, 'administrative_area_level_1', true),
    postalCode: pick(c, 'postal_code'),
    formattedAddress: data.result.formatted_address,
    latitude: data.result.geometry.location.lat,
    longitude: data.result.geometry.location.lng,
  };
}

export interface StaticMapOptions {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  scale?: 1 | 2;
}

/** Builds a Static Maps URL with a brand-tinted pin. Null if maps unconfigured. */
export function staticMapUrl(opts: StaticMapOptions): string | null {
  if (!GOOGLE_KEY) return null;
  const { lat, lng, zoom = 15, width = 600, height = 320, scale = 2 } = opts;
  const url = new URL(`${BASE}/staticmap`);
  const center = `${lat},${lng}`;
  url.searchParams.set('center', center);
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('size', `${width}x${height}`);
  url.searchParams.set('scale', String(scale));
  url.searchParams.set('markers', `color:0xA87044|${center}`);
  url.searchParams.set('key', GOOGLE_KEY);
  return url.toString();
}

/** Directions between two points by travel mode. */
export async function getDirections(args: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  mode: 'driving' | 'walking';
}): Promise<DirectionsResult> {
  const url = new URL(`${BASE}/directions/json`);
  url.searchParams.set('origin', `${args.originLat},${args.originLng}`);
  url.searchParams.set('destination', `${args.destLat},${args.destLng}`);
  url.searchParams.set('mode', args.mode);
  url.searchParams.set('key', key());

  const res = await fetch(url);
  const data = (await res.json()) as DirectionsResponse;
  if (data.status === 'ZERO_RESULTS') return { found: false };
  const leg = data.routes?.[0]?.legs?.[0];
  if (data.status !== 'OK' || !leg) throw new Error(data.error_message ?? data.status);
  return {
    found: true,
    distanceText: leg.distance.text,
    distanceMeters: leg.distance.value,
    durationText: leg.duration.text,
    durationSeconds: leg.duration.value,
    polyline: data.routes?.[0]?.overview_polyline.points ?? null,
  };
}


/** Live Google reviews for a place (max 5, newest first). */
export async function getPlaceReviews(placeId: string): Promise<PlaceReviewsResult> {
  const url = new URL(`${BASE}/place/details/json`);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('key', key());
  url.searchParams.set('fields', 'rating,user_ratings_total,url,reviews');
  url.searchParams.set('reviews_sort', 'newest');

  const res = await fetch(url);
  const data = (await res.json()) as PlaceDetailsResponse;
  if (data.status !== 'OK' || !data.result) return { available: false };
  return {
    available: true,
    rating: data.result.rating ?? null,
    totalRatings: data.result.user_ratings_total ?? null,
    attributionUrl: data.result.url ?? null,
    reviews: (data.result.reviews ?? []).slice(0, 5).map((r) => ({
      authorName: r.author_name,
      photoUrl: r.profile_photo_url ?? null,
      rating: r.rating,
      relativeTime: r.relative_time_description,
      text: r.text,
    })),
  };
}
