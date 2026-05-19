import { z } from 'zod';

import { listSavedDealIds, toggleSaved } from '../domain/saved';
import { protectedProcedure, router } from './trpc';

export const savedRouter = router({
  listIds: protectedProcedure.query(({ ctx }) => listSavedDealIds(ctx.sql, ctx.auth.userId)),

  toggle: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .mutation(({ ctx, input }) => toggleSaved(ctx.sql, ctx.auth.userId, input.dealId)),
});
