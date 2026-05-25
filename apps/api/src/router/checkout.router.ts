import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createGiftLink, createPurchase } from '../domain/checkout';
import { protectedProcedure, router } from './trpc';

/**
 * Public origin where the Gloē-hosted gift landing page lives. Used to build
 * the URL we hand back to the customer for sharing. Defaults to the prod web
 * domain — override locally with PUBLIC_WEB_ORIGIN.
 */
const PUBLIC_WEB_ORIGIN = process.env.PUBLIC_WEB_ORIGIN ?? 'https://app.gloe.beauty';

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

  /**
   * "Share to pay" — generate a Gloē-hosted gift URL that the signed-in
   * customer (the redeemer) can text/share to whoever's actually paying.
   * The voucher credits to the redeemer's account on payment success.
   */
  createGiftLink: protectedProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(10).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createGiftLink(ctx.sql, {
          redeemerUserId: ctx.auth.userId,
          variantId: input.variantId,
          quantity: input.quantity,
          publicOrigin: PUBLIC_WEB_ORIGIN,
        });
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
    }),
});
