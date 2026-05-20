import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { publicProcedure, router } from './trpc';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface GooglePrediction {
  description: string;
  place_id: string;
}

interface GoogleAutocompleteResponse {
  status: string;
  predictions: GooglePrediction[];
  error_message?: string;
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceDetailsResponse {
  status: string;
  error_message?: string;
  result?: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: GoogleAddressComponent[];
  };
}

function pickComponent(
  components: GoogleAddressComponent[],
  type: string,
  useShort = false,
): string {
  const c = components.find((comp) => comp.types.includes(type));
  if (!c) return '';
  return useShort ? c.short_name : c.long_name;
}

/**
 * Address autocomplete + details via Google Places. Server-side only — the key
 * never reaches the client. Wrapped behind tRPC so the client just calls
 * `geocode.autocomplete` / `geocode.placeDetails`.
 */
export const geocodeRouter = router({
  /** Type-ahead suggestions. Returns place predictions with a place_id. */
  autocomplete: publicProcedure
    .input(z.object({ query: z.string().min(3) }))
    .query(async ({ input }) => {
      if (!GOOGLE_KEY) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Maps not configured' });
      }
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input.query);
      url.searchParams.set('key', GOOGLE_KEY);
      url.searchParams.set('components', 'country:us');
      url.searchParams.set('types', 'address');

      try {
        const res = await fetch(url);
        const data = (await res.json()) as GoogleAutocompleteResponse;
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          throw new Error(data.error_message ?? data.status);
        }
        return data.predictions.map((p) => ({
          description: p.description,
          placeId: p.place_id,
        }));
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Address lookup failed. Try again.',
        });
      }
    }),

  /** Resolve a selected place_id to full address parts + coordinates. */
  placeDetails: publicProcedure
    .input(z.object({ placeId: z.string() }))
    .query(async ({ input }) => {
      if (!GOOGLE_KEY) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Maps not configured' });
      }
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', input.placeId);
      url.searchParams.set('key', GOOGLE_KEY);
      url.searchParams.set('fields', 'formatted_address,geometry,address_component');

      try {
        const res = await fetch(url);
        const data = (await res.json()) as GooglePlaceDetailsResponse;
        if (data.status !== 'OK' || !data.result) {
          throw new Error(data.error_message ?? data.status);
        }
        const c = data.result.address_components;
        const streetNumber = pickComponent(c, 'street_number');
        const route = pickComponent(c, 'route');
        return {
          addressLine1: [streetNumber, route].filter(Boolean).join(' '),
          city:
            pickComponent(c, 'locality') ||
            pickComponent(c, 'sublocality') ||
            pickComponent(c, 'administrative_area_level_2'),
          region: pickComponent(c, 'administrative_area_level_1', true),
          postalCode: pickComponent(c, 'postal_code'),
          formattedAddress: data.result.formatted_address,
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
        };
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not resolve that address.',
        });
      }
    }),
});
