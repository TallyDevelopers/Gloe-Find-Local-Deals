import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { autocompleteAddress, resolvePlace } from '../domain/googleMaps';
import { publicProcedure, router } from './trpc';

/**
 * Address autocomplete + details. All Google access goes through the
 * googleMaps client; this router just maps it to tRPC + friendly errors.
 */
export const geocodeRouter = router({
  /** Type-ahead suggestions. Returns place predictions with a place_id. */
  autocomplete: publicProcedure
    .input(z.object({ query: z.string().min(3) }))
    .query(async ({ input }) => {
      try {
        return await autocompleteAddress(input.query);
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
