import { initTRPC, TRPCError } from '@trpc/server';

import type { RequestContext } from '../context/context';

const t = initTRPC.context<RequestContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Procedure that requires a signed-in user. Available as ctx.auth.userId
 * downstream — non-null thanks to the middleware narrowing.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in required' });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});
