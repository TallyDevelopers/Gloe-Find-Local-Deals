import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createPurchase } from '../domain/checkout';
import { protectedProcedure, router } from './trpc';

export const checkoutRouter = router({
  /**
   * Start a purchase. Returns a Stripe client secret for the app's payment
   * sheet. On payment success the webhook creates the voucher(s). Sign-in
   * required (it's a real purchase tied to the user's wallet).
   */
  createPurchase: protectedProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createPurchase(ctx.sql, {
          userId: ctx.auth.userId,
          variantId: input.variantId,
          quantity: input.quantity,
        });
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
    }),
});
