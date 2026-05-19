import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createReview, listReviewsForVendor } from '../domain/reviews';
import { protectedProcedure, publicProcedure, router } from './trpc';

export const reviewsRouter = router({
  listForVendor: publicProcedure
    .input(z.object({ vendorId: z.string().uuid(), limit: z.number().int().positive().max(50).optional() }))
    .query(({ ctx, input }) => listReviewsForVendor(ctx.sql, input.vendorId, input.limit)),

  create: protectedProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        body: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createReview(ctx.sql, {
          userId: ctx.auth.userId,
          claimId: input.claimId,
          rating: input.rating,
          body: input.body,
        });
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Failed to create review',
        });
      }
    }),
});
