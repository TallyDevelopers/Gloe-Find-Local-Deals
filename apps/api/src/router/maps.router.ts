import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getDirections, getPlaceReviews, staticMapUrl } from '../domain/googleMaps';
import { publicProcedure, router } from './trpc';

/**
 * Maps endpoints used by the deal redemption location + reviews. All Google
 * access goes through the googleMaps client; this router only maps to tRPC.
 */
export const mapsRouter = router({
  /** Static Maps URL with a pin — the client renders it in an <img>/<Image>. */
  staticMapUrl: publicProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
        zoom: z.number().int().min(1).max(20).default(15),
        width: z.number().int().min(100).max(640).default(600),
        height: z.number().int().min(100).max(640).default(320),
        scale: z.union([z.literal(1), z.literal(2)]).default(2),
      }),
    )
    .query(({ input }) => {
      const url = staticMapUrl(input);
      if (!url) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Maps not configured' });
      return { url };
    }),

  /** Distance + ETA + route polyline from the customer to the deal, by mode. */
  directions: publicProcedure
    .input(
      z.object({
        originLat: z.number(),
        originLng: z.number(),
        destLat: z.number(),
        destLng: z.number(),
        mode: z.enum(['driving', 'walking']).default('driving'),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getDirections(input);
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not calculate distance.' });
      }
    }),

  /**
   * Live Google reviews (max 5). Per Google's terms these are fetched live and
   * never cached/stored; called lazily so there's no per-view cost.
   */
  googleReviews: publicProcedure
    .input(z.object({ placeId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await getPlaceReviews(input.placeId);
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not load Google reviews.' });
      }
    }),
});
