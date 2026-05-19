import { protectedProcedure, router } from './trpc';

export const meRouter = router({
  whoami: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.sql<{
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
      monthly_redemption_limit: number;
      monthly_redemptions_used: number;
    }[]>`
      SELECT id, email, first_name, last_name, image_url,
             monthly_redemption_limit, monthly_redemptions_used
      FROM public.users
      WHERE id = ${ctx.auth.userId}
      LIMIT 1
    `;
    const u = rows[0];
    if (!u) throw new Error('User missing');
    return {
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      imageUrl: u.image_url,
      monthlyRedemptionLimit: u.monthly_redemption_limit,
      monthlyRedemptionsUsed: u.monthly_redemptions_used,
    };
  }),
});
