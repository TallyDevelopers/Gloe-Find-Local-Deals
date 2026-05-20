import { categoriesRouter } from './categories.router';
import { claimsRouter } from './claims.router';
import { dealsRouter } from './deals.router';
import { geocodeRouter } from './geocode.router';
import { meRouter } from './me.router';
import { reviewsRouter } from './reviews.router';
import { savedRouter } from './saved.router';
import { router } from './trpc';
import { vendorRouter } from './vendor.router';
import { vendorsRouter } from './vendors.router';

export const appRouter = router({
  deals: dealsRouter,
  vendors: vendorsRouter,    // public vendor browsing (consumer side)
  vendor: vendorRouter,      // vendor's own account (business side)
  saved: savedRouter,
  claims: claimsRouter,
  reviews: reviewsRouter,
  me: meRouter,
  geocode: geocodeRouter,
  categories: categoriesRouter,
});

export type AppRouter = typeof appRouter;
