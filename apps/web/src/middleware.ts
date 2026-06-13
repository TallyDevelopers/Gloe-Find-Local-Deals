import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Public routes don't require auth. The consumer marketplace (home, search,
 * deal + spa pages) is fully browsable signed-out; saved/wallet/account gate
 * themselves. Vendor + admin portals require a signed-in user — role-gating
 * happens in their layouts.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/search(.*)', // consumer search
  '/deals/(.*)', // public deal detail (SEO)
  '/spa/(.*)', // public vendor storefront (SEO)
  '/treatments/(.*)', // public category listing (SEO)
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/business(.*)', // "For Businesses" landing (moved off /)
  '/for-business(.*)', // legacy alias
  '/legal/(.*)', // terms / privacy
  '/gift/(.*)', // shared payment links — recipients are anonymous
  '/r/(.*)', // referral invite landing — the whole point is signed-out arrivals
  '/sitemap.xml', // crawlers — must be reachable signed-out
  '/robots.txt',
  '/manifest.webmanifest',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
