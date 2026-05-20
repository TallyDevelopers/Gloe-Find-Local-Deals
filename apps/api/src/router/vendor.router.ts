import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createVendor, getSetupStatus, getVendorForOwner } from '../domain/vendorSignup';
import { protectedProcedure, router } from './trpc';

export const vendorRouter = router({
  /** The vendor owned by the current signed-in user (null if they haven't signed up as a vendor). */
  me: protectedProcedure.query(({ ctx }) => getVendorForOwner(ctx.sql, ctx.auth.userId)),

  /** Setup completion + whether they can post deals yet. */
  setupStatus: protectedProcedure.query(({ ctx }) => getSetupStatus(ctx.sql, ctx.auth.userId)),

  /** Minimal "get through the door" signup. Creates a pending_approval vendor. */
  signup: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(2).max(120),
        phone: z.string().min(7).max(20),
        addressLine1: z.string().min(3).max(200),
        city: z.string().min(2).max(80),
        region: z.string().min(2).max(40),
        postalCode: z.string().min(3).max(12),
        latitude: z.number(),
        longitude: z.number(),
        categorySlugs: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getVendorForOwner(ctx.sql, ctx.auth.userId);
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have a business account.',
        });
      }
      return createVendor(ctx.sql, { ownerUserId: ctx.auth.userId, ...input });
    }),
});
