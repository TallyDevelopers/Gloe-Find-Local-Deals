import { z } from 'zod';

import { attributeSignup, ensureReferralCode } from '../domain/referrals';
import { protectedProcedure, publicProcedure, router } from './trpc';

/** Same default as checkout.router — the shareable /r/CODE links live here. */
const PUBLIC_WEB_ORIGIN = process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app';

/**
 * Give $20 / get $20 referrals (GLO-24). Amounts come from the ACTIVE
 * `credit_rules` referral row — god-mode editable, so the UI reads them from
 * `program` instead of hardcoding copy.
 */
export const referralRouter = router({
  /**
   * Public program shape for landing/marketing copy (the /r/[code] page is
   * browsable signed-out). Null when the program is paused — hide the surface.
   */
  program: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.sql<{
      give_cents: number;
      get_cents: number;
      min_first_purchase_cents: number | null;
    }[]>`
      SELECT give_cents, get_cents, min_first_purchase_cents
      FROM public.credit_rules
      WHERE rule_type = 'referral' AND active = true
        AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    return {
      giveCents: r.give_cents,
      getCents: r.get_cents,
      minFirstPurchaseCents: r.min_first_purchase_cents ?? 0,
    };
  }),

  /** The signed-in user's shareable code (minted lazily for pre-GLO-24 users). */
  getCode: protectedProcedure.query(async ({ ctx }) => {
    const code = await ensureReferralCode(ctx.sql, ctx.auth.userId);
    return { code, url: `${PUBLIC_WEB_ORIGIN}/r/${code}` };
  }),

  /** Referral scoreboard + whether THIS user can still submit a code. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    const inviteRows = await ctx.sql<{ invited: number }[]>`
      SELECT COUNT(*)::int AS invited FROM public.users WHERE referred_by = ${userId}
    `;
    const earnRows = await ctx.sql<{ qualified: number; earned: number }[]>`
      SELECT COUNT(*)::int AS qualified, COALESCE(SUM(amount_cents), 0)::int AS earned
      FROM public.credit_lots
      WHERE user_id = ${userId} AND kind = 'referral_get'
    `;
    // Referee-side eligibility (mirrors attributeSignup's walls): no code yet,
    // signed up within 7 days, no purchases.
    const meRows = await ctx.sql<{ referred_by: string | null; created_at: string }[]>`
      SELECT referred_by, created_at FROM public.users WHERE id = ${userId} LIMIT 1
    `;
    const purchased = await ctx.sql<{ one: number }[]>`
      SELECT 1 AS one FROM public.transactions
      WHERE user_id = ${userId} AND paid_at IS NOT NULL
      LIMIT 1
    `;
    const me = meRows[0];
    const canSubmitCode =
      !!me &&
      !me.referred_by &&
      !purchased[0] &&
      Date.now() - new Date(me.created_at).getTime() <= 7 * 86_400_000;

    return {
      invited: inviteRows[0]?.invited ?? 0,
      qualified: earnRows[0]?.qualified ?? 0,
      earnedCents: earnRows[0]?.earned ?? 0,
      canSubmitCode,
    };
  }),

  /**
   * Late attribution — a signed-in user pastes a code within 7 days of signup,
   * before any purchase. Refusals come back as `{attributed: false, reason}`
   * (never throws) so the UI can explain without a 4xx.
   */
  submitCode: protectedProcedure
    .input(z.object({ code: z.string().trim().min(4).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const emailRows = await ctx.sql<{ email: string | null }[]>`
        SELECT email FROM public.users WHERE id = ${ctx.auth.userId} LIMIT 1
      `;
      return attributeSignup(ctx.sql, {
        userId: ctx.auth.userId,
        code: input.code,
        email: emailRows[0]?.email ?? null,
      });
    }),
});
