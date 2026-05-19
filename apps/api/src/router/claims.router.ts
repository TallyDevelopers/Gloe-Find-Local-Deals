import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  createClaim,
  devMarkRedeemed,
  getClaimByIdForUser,
  listClaimsForUser,
} from '../domain/claims';
import { protectedProcedure, router } from './trpc';

export const claimsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listClaimsForUser(ctx.sql, ctx.auth.userId)),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const claim = await getClaimByIdForUser(ctx.sql, ctx.auth.userId, input.id);
      if (!claim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Claim not found' });
      return claim;
    }),

  create: protectedProcedure
    .input(
      z.object({
        dealId: z.string().uuid(),
        variantId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createClaim(ctx.sql, {
          userId: ctx.auth.userId,
          dealId: input.dealId,
          variantId: input.variantId,
        });
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Failed to create claim',
        });
      }
    }),

  // Dev-only — until the vendor app exists
  devMarkRedeemed: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await devMarkRedeemed(ctx.sql, ctx.auth.userId, input.id);
      return { ok: true };
    }),
});
