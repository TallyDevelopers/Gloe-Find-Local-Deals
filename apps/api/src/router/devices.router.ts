import { z } from 'zod';

import { registerDeviceToken } from '../domain/devices';
import { protectedProcedure, router } from './trpc';

export const devicesRouter = router({
  /**
   * Called by the mobile app on every cold launch (and again whenever Expo
   * hands us a new token). Idempotent — repeats are cheap. Server bumps
   * last_seen_at so we can prune dead devices later.
   */
  register: protectedProcedure
    .input(
      z.object({
        platform: z.enum(['ios', 'android']),
        token: z.string().min(20).max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await registerDeviceToken(ctx.sql, {
        userId: ctx.auth.userId,
        platform: input.platform,
        token: input.token,
      });
      return { ok: true };
    }),
});
