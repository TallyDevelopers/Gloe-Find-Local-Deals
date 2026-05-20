import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { publicProcedure, router } from './trpc';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Address → coordinates. Uses OpenStreetMap Nominatim (free, no key) for v0.
 * Swap for Google/Mapbox geocoding later for better accuracy + rate limits.
 * Wrapped behind tRPC so the client never calls a geocoder directly.
 */
export const geocodeRouter = router({
  forward: publicProcedure
    .input(z.object({ query: z.string().min(3) }))
    .query(async ({ input }) => {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', input.query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '5');
      url.searchParams.set('countrycodes', 'us');

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Gloe/0.1 (vendor onboarding geocode)' },
        });
        if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
        const results = (await res.json()) as NominatimResult[];
        return results.map((r) => ({
          label: r.display_name,
          latitude: Number(r.lat),
          longitude: Number(r.lon),
        }));
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not look up that address. Try again.',
        });
      }
    }),
});
