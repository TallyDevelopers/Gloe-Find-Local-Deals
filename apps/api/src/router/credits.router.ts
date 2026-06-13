import { z } from 'zod';

import { protectedProcedure, router } from './trpc';

/**
 * Consumer-facing wallet credits (GLO-24). Read-only — credits are granted by
 * the engine (referrals, campaigns, admin) and spent automatically at checkout
 * (`applyCredits` on the checkout mutations). The client never sends amounts.
 */
export const creditsRouter = router({
  /**
   * Wallet balance summary. `availableCents` is spendable now (negatives from
   * clawbacks net it down, floor 0). `lockedCents` is the referee's welcome
   * credit, waiting on a first booking of `lockedFloorCents`+ (pre-credit).
   */
  balance: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;

    const userRows = await ctx.sql<{ credit_frozen_at: string | null }[]>`
      SELECT credit_frozen_at FROM public.users WHERE id = ${userId} LIMIT 1
    `;
    const lots = await ctx.sql<{
      kind: string;
      remaining_cents: number;
      expires_at: string | null;
      min_first_purchase_cents: number | null;
    }[]>`
      SELECT l.kind, l.remaining_cents, l.expires_at, r.min_first_purchase_cents
      FROM public.credit_lots l
      LEFT JOIN public.credit_rules r ON r.id = l.rule_id
      WHERE l.user_id = ${userId} AND l.remaining_cents <> 0
      ORDER BY l.expires_at ASC NULLS LAST, l.created_at ASC
    `;
    const purchased = await ctx.sql<{ one: number }[]>`
      SELECT 1 AS one FROM public.transactions
      WHERE user_id = ${userId} AND paid_at IS NOT NULL
      LIMIT 1
    `;
    const hasPurchased = !!purchased[0];
    const now = Date.now();

    let negativeCents = 0;
    let availableCents = 0;
    let lockedCents = 0;
    let lockedFloorCents = 0;
    let soonestExpiry: { expiresAt: string; amountCents: number } | null = null;
    for (const lot of lots) {
      if (lot.remaining_cents < 0) {
        negativeCents += lot.remaining_cents; // clawback debt — nets the total
        continue;
      }
      if (lot.expires_at && new Date(lot.expires_at).getTime() <= now) continue;
      if (lot.kind === 'referral_give') {
        // Welcome credit only spends on a qualifying FIRST purchase — after
        // any purchase it's dead, before one it's "locked" with the condition.
        if (!hasPurchased) {
          lockedCents += lot.remaining_cents;
          lockedFloorCents = Math.max(lockedFloorCents, lot.min_first_purchase_cents ?? 0);
        }
        continue;
      }
      availableCents += lot.remaining_cents;
      if (lot.expires_at && !soonestExpiry) {
        soonestExpiry = { expiresAt: lot.expires_at, amountCents: lot.remaining_cents };
      }
    }
    availableCents = Math.max(0, availableCents + negativeCents);

    return {
      availableCents,
      lockedCents,
      /** Pre-credit first-order total that unlocks the locked welcome credit. */
      lockedFloorCents,
      soonestExpiry: availableCents > 0 ? soonestExpiry : null,
      /** Ledger frozen during an open payment dispute — credits won't apply. */
      frozen: !!userRows[0]?.credit_frozen_at,
    };
  }),

  /** Ledger history, newest first: grants (+) and redemptions/expiries/… (−). */
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.sql<{
        id: string;
        kind: string;
        amount_cents: number;
        note: string | null;
        created_at: string;
        expires_at: string | null;
      }[]>`
        SELECT id, kind, amount_cents, note, created_at, expires_at
        FROM public.credit_lots
        WHERE user_id = ${ctx.auth.userId}
        UNION ALL
        SELECT id, kind, amount_cents, NULL AS note, created_at, NULL AS expires_at
        FROM public.credit_entries
        WHERE user_id = ${ctx.auth.userId}
        ORDER BY created_at DESC
        LIMIT ${input?.limit ?? 50}
      `;
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        amountCents: r.amount_cents,
        note: r.note,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
      }));
    }),
});
