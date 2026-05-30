import { z } from 'zod';

import { listLiveCities } from '../domain/deals';
import {
  getWaitlistTotals,
  joinWaitlist,
  listWaitlistByCity,
  listWaitlistEntries,
} from '../domain/waitlist';
import { adminProcedure, publicProcedure, router } from './trpc';

export const waitlistRouter = router({
  /**
   * Public: a far-away user (often not signed in) asks to be notified when
   * Gloē reaches their area. Idempotent on email.
   */
  join: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        cityLabel: z.string().max(120).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
      }),
    )
    .mutation(({ ctx, input }) => joinWaitlist(ctx.sql, input)),

  /**
   * Public: distinct cities that currently have live deals — for the
   * "Now live in …" copy on the coming-soon screen. Auto-updates as you expand.
   */
  liveCities: publicProcedure.query(({ ctx }) => listLiveCities(ctx.sql)),

  /* ── Admin (god mode) ── */
  adminByCity: adminProcedure.query(({ ctx }) => listWaitlistByCity(ctx.sql)),
  adminTotals: adminProcedure.query(({ ctx }) => getWaitlistTotals(ctx.sql)),
  adminEntries: adminProcedure
    .input(z.object({ city: z.string().optional(), limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => listWaitlistEntries(ctx.sql, input ?? {})),
});
