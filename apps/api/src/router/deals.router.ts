import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getDeal, getTrendingTreatments, listDeals, suggestSearchTerms } from '../domain/deals';
import { publicProcedure, router } from './trpc';

const sortEnum = z.enum(['relevance', 'distance', 'price', 'rating', 'discount']);

export const dealsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          userLat: z.number().optional(),
          userLng: z.number().optional(),
          maxDistanceMiles: z.number().positive().optional(),
          category: z.string().optional(),
          limit: z.number().int().positive().max(100).optional(),
          offset: z.number().int().min(0).optional(),
          // Advanced filters from the filter sheet
          minPriceCents: z.number().int().min(0).optional(),
          maxPriceCents: z.number().int().min(0).optional(),
          /** 0-100, e.g. 30 means "at least 30% off". */
          minDiscountPct: z.number().int().min(0).max(100).optional(),
          /**
           * Anonymous seed for ranking jitter. Mobile generates + stores a UUID
           * once per install. Signed-in users override this with their real
           * user id server-side (more accurate per-user personalization later).
           */
          anonSeed: z.string().max(64).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      // Prefer the real signed-in user id (stable across devices) over the
      // device-local anon seed. Both are fine inputs to listDeals — they just
      // produce a deterministic-per-viewer-per-day jitter.
      const viewerSeed = ctx.auth?.userId ?? input?.anonSeed;
      return listDeals(ctx.sql, { ...(input ?? {}), viewerSeed });
    }),

  /**
   * Full-text search over deals — fuzzy (typo-tolerant) + aesthetic synonym
   * aware ("tox" → all neuromodulators), location-ranked. Same ranking core as
   * `list` with a text-relevance term folded in; all the list filters apply.
   */
  search: publicProcedure
    .input(
      z.object({
        q: z.string().max(120),
        userLat: z.number().optional(),
        userLng: z.number().optional(),
        maxDistanceMiles: z.number().positive().optional(),
        category: z.string().optional(),
        subtypeSlug: z.string().optional(),
        minPriceCents: z.number().int().min(0).optional(),
        maxPriceCents: z.number().int().min(0).optional(),
        minDiscountPct: z.number().int().min(0).max(100).optional(),
        minRating: z.number().min(0).max(5).optional(),
        sort: sortEnum.optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
        anonSeed: z.string().max(64).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const viewerSeed = ctx.auth?.userId ?? input.anonSeed;
      return listDeals(ctx.sql, { ...input, viewerSeed });
    }),

  /** Type-ahead autocomplete for the search box (treatment suggestions). */
  suggest: publicProcedure
    .input(
      z.object({
        q: z.string().max(120),
        userLat: z.number().optional(),
        userLng: z.number().optional(),
        maxDistanceMiles: z.number().positive().optional(),
        limit: z.number().int().positive().max(20).optional(),
      }),
    )
    .query(({ ctx, input }) => suggestSearchTerms(ctx.sql, input.q, input)),

  /** Popular treatments near the user — zero-state chips for the search screen. */
  trending: publicProcedure
    .input(
      z
        .object({
          userLat: z.number().optional(),
          userLng: z.number().optional(),
          maxDistanceMiles: z.number().positive().optional(),
          limit: z.number().int().positive().max(20).optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => getTrendingTreatments(ctx.sql, input ?? {})),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deal = await getDeal(ctx.sql, input.id);
      if (!deal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      }
      return deal;
    }),
});
