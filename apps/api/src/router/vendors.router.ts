import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getVendor } from '../domain/vendors';
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
});
