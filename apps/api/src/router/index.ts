import { claimsRouter } from './claims.router';
import { dealsRouter } from './deals.router';
import { meRouter } from './me.router';
import { reviewsRouter } from './reviews.router';
import { savedRouter } from './saved.router';
import { router } from './trpc';
import { vendorsRouter } from './vendors.router';

export const appRouter = router({
  deals: dealsRouter,
  vendors: vendorsRouter,
  saved: savedRouter,
  claims: claimsRouter,
  reviews: reviewsRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;
