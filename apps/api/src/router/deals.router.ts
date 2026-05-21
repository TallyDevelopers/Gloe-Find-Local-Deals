import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getDeal, listDeals } from '../domain/deals';
import { publicProcedure, router } from './trpc';

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
        })
        .optional(),
    )
    .query(({ ctx, input }) => listDeals(ctx.sql, input ?? {})),

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
