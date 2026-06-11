import { adminRouter } from './admin.router';
import { categoriesRouter } from './categories.router';
import { checkoutRouter } from './checkout.router';
import { claimsRouter } from './claims.router';
import { creditsRouter } from './credits.router';
import { dealsRouter } from './deals.router';
import { devicesRouter } from './devices.router';
import { geocodeRouter } from './geocode.router';
import { mapsRouter } from './maps.router';
import { meRouter } from './me.router';
import { referralRouter } from './referral.router';
import { reviewsRouter } from './reviews.router';
import { savedRouter } from './saved.router';
import { supportRouter } from './support.router';
import { router } from './trpc';
import { vendorRouter } from './vendor.router';
import { vendorsRouter } from './vendors.router';
import { waitlistRouter } from './waitlist.router';

export const appRouter = router({
  admin: adminRouter,
  checkout: checkoutRouter,
  deals: dealsRouter,
  vendors: vendorsRouter,    // public vendor browsing (consumer side)
  vendor: vendorRouter,      // vendor's own account (business side)
  saved: savedRouter,
  support: supportRouter,
  claims: claimsRouter,
  credits: creditsRouter,
  referral: referralRouter,
  reviews: reviewsRouter,
  me: meRouter,
  geocode: geocodeRouter,
  maps: mapsRouter,
  categories: categoriesRouter,
  devices: devicesRouter,
  waitlist: waitlistRouter,
});

export type AppRouter = typeof appRouter;
