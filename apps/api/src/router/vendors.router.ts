import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getVendor } from '../domain/vendors';
import { getVendorStorefront } from '../domain/vendorStorefront';
import { publicProcedure, router } from './trpc';

export const vendorsRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vendor = await getVendor(ctx.sql, input.id);
      if (!vendor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      }
      return vendor;
    }),

  /**
   * Full consumer-facing storefront: vendor profile + active deals + providers
   * + videos + reviews (Gloe + Google). One query, populated in parallel.
   * Cache-aware Google refresh runs inside if their reviews are >24h stale.
   */
  storefront: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const data = await getVendorStorefront(ctx.sql, input.id);
      if (!data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      }
      return data;
    }),
});
