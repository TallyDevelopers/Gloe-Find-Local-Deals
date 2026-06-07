import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { autocompleteAddress, resolvePlace } from '../domain/googleMaps';
import { publicProcedure, router } from './trpc';

/**
 * Address autocomplete + details. All Google access goes through the
 * googleMaps client; this router just maps it to tRPC + friendly errors.
 */
export const geocodeRouter = router({
  /**
   * Type-ahead suggestions. Returns place predictions with a place_id.
   * `types` defaults to street addresses (deal creation); the browse-location
   * picker passes 'geocode' so city names autocomplete too.
   *
   * COST: GPS + the popular-cities list are Google-free; only typing a search
   * hits Google. Each keystroke (debounced ~250ms, 3-char min) is one
   * Autocomplete request (~$2.83/1k) + one Details on selection (~$17/1k). At
   * ≤~5k active users this sits inside Google's $200/mo free credit.
   * TODO(scale, ~10k+ users): pass a Places `sessiontoken` from the client
   * through autocomplete → placeDetails so a whole typing session bills as one
   * unit instead of per-keystroke. Also set a Google Cloud billing alert.
   */
  autocomplete: publicProcedure
    .input(z.object({ query: z.string().min(3), types: z.enum(['address', 'geocode']).optional() }))
    .query(async ({ input }) => {
      try {
        return await autocompleteAddress(input.query, input.types);
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Address lookup failed. Try again.' });
      }
    }),

  /** Resolve a selected place_id to full address parts + coordinates. */
  placeDetails: publicProcedure
    .input(z.object({ placeId: z.string() }))
    .query(async ({ input }) => {
      try {
        const place = await resolvePlace(input.placeId);
        if (!place) throw new Error('not found');
        return place;
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not resolve that address.' });
      }
    }),
});
