import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

import type { RequestContext } from '../context/context';
import { isAdmin } from '../domain/admin';

/** "amountCents" → "Amount", "messageTitle" → "Message title". */
function humanizeField(path: (string | number)[]): string | null {
  const last = [...path].reverse().find((p): p is string => typeof p === 'string');
  if (!last) return null;
  const words = last
    .replace(/Cents$/, '')
    .replace(/Bps$/, ' percent')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

const ZOD_DEFAULT_MESSAGE = /^(String must|Number must|Expected |Invalid|Required$|Array must|Value must)/;

/**
 * One human sentence from a ZodError instead of the raw JSON issue dump.
 * Custom messages written in the routers are full sentences — pass them
 * through untouched; only zod's stock phrasing gets a field-name prefix.
 */
export function friendlyZodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'That input isn’t valid.';
  if (!ZOD_DEFAULT_MESSAGE.test(issue.message)) return issue.message;
  const label = humanizeField(issue.path);
  if (issue.code === 'invalid_type' && (issue.received === 'undefined' || issue.received === 'null')) {
    return label ? `${label} is required.` : 'A required field is missing.';
  }
  if (issue.code === 'invalid_type' && issue.received === 'nan') {
    return label ? `${label} must be a valid number.` : 'Enter a valid number.';
  }
  return label ? `${label}: ${issue.message.toLowerCase()}` : issue.message;
}

const t = initTRPC.context<RequestContext>().create({
  errorFormatter({ shape, error }) {
    if (error.cause instanceof ZodError) {
      return { ...shape, message: friendlyZodMessage(error.cause) };
    }
    return shape;
  },
});

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

/** Procedure gated to admin_users — the founder console. */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in required' });
  }
  if (!(await isAdmin(ctx.sql, ctx.auth.userId))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});
