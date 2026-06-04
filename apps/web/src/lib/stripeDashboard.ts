/**
 * Build a Stripe Dashboard URL that points at the right mode (live vs test).
 *
 * We can't read the secret key on the client, but the publishable key is
 * already exposed as NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and its prefix
 * (`pk_live_` vs `pk_test_`) tells us the mode. Test-mode URLs carry a `/test`
 * segment; live-mode URLs don't. Hardcoding `/test/` (the old behavior) meant
 * every "open in Stripe" link 404'd once the business went live.
 */
const IS_LIVE = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_live_');

export function stripeDashboardUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return IS_LIVE
    ? `https://dashboard.stripe.com/${clean}`
    : `https://dashboard.stripe.com/test/${clean}`;
}
