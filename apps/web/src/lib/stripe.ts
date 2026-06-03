import { loadStripe } from '@stripe/stripe-js';

/**
 * Singleton Stripe.js instance for embedded checkout on the consumer web.
 * Publishable key is public by design (ships in the browser bundle).
 */
const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = key ? loadStripe(key) : null;
