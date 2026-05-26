import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createSignedUpload } from '../db/storage';
import { createReview, getReviewForClaim, listReviewsForVendor } from '../domain/reviews';
import { protectedProcedure, publicProcedure, router } from './trpc';

export const reviewsRouter = router({
  listForVendor: publicProcedure
    .input(z.object({ vendorId: z.string().uuid(), limit: z.number().int().positive().max(50).optional() }))
    .query(({ ctx, input }) => listReviewsForVendor(ctx.sql, input.vendorId, input.limit)),

  /** Did the signed-in user already review this claim? Returns null if not. */
  byClaim: protectedProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .query(({ ctx, input }) => getReviewForClaim(ctx.sql, input.claimId, ctx.auth.userId)),

  create: protectedProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        body: z.string().max(2000).optional(),
        // Already-uploaded photo URLs (caller uploads first via signPhotoUpload).
        photoUrls: z.array(z.string().url()).max(3).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createReview(ctx.sql, {
          userId: ctx.auth.userId,
          claimId: input.claimId,
          rating: input.rating,
          body: input.body,
          photoUrls: input.photoUrls,
        });
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Failed to create review',
        });
      }
    }),

  /**
   * Issue a signed upload URL for a review photo. Customer-side equivalent of
   * the vendor's signPhotoUpload — uploads land in the public `review-photos`
   * bucket scoped under the user's id.
   */
  signPhotoUpload: protectedProcedure
    .input(z.object({ fileExt: z.string().max(8) }))
    .mutation(({ ctx, input }) => createSignedUpload(ctx.auth.userId, input.fileExt, 'review')),
});
