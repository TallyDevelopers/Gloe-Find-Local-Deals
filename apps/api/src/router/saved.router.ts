import { z } from 'zod';

import {
  listSavedDealIds,
  listSavedVendorIds,
  listSavedVendors,
  toggleSaved,
  toggleSavedVendor,
} from '../domain/saved';
import { protectedProcedure, router } from './trpc';

export const savedRouter = router({
  // Saved deals
  listIds: protectedProcedure.query(({ ctx }) => listSavedDealIds(ctx.sql, ctx.auth.userId)),
  toggle: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .mutation(({ ctx, input }) => toggleSaved(ctx.sql, ctx.auth.userId, input.dealId)),

  // Saved vendors (parallel set, keyed on vendor)
  listVendorIds: protectedProcedure.query(({ ctx }) => listSavedVendorIds(ctx.sql, ctx.auth.userId)),
  listVendors: protectedProcedure.query(({ ctx }) => listSavedVendors(ctx.sql, ctx.auth.userId)),
  toggleVendor: protectedProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(({ ctx, input }) => toggleSavedVendor(ctx.sql, ctx.auth.userId, input.vendorId)),
});
