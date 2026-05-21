// Aliased so the type can't collide with @stripe/stripe-react-native's ambient
// `Stripe` namespace when this file is type-resolved from the mobile project.
import StripeNode from 'stripe';

/**
 * The single seam to Stripe. Everything Stripe goes through here — nothing else
 * reads STRIPE_SECRET_KEY or touches the SDK directly. Swapping providers or
 * rotating keys is a one-file change.
 *
 * Connect model (chosen in dashboard): Express accounts, hosted onboarding,
 * Express dashboard. Funds flow buyer → platform → vendor (separate
 * charges & transfers), individual payouts.
 */

const SECRET = process.env.STRIPE_SECRET_KEY;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe not configured');
    this.name = 'StripeNotConfiguredError';
  }
}

// Typed via the constructor's instance type so it doesn't depend on the
// `Stripe` namespace resolving consistently across projects (mobile vs api).
type StripeClient = InstanceType<typeof StripeNode>;

let _stripe: StripeClient | null = null;
function client(): StripeClient {
  if (!SECRET) throw new StripeNotConfiguredError();
  if (!_stripe) _stripe = new StripeNode(SECRET, { apiVersion: '2026-04-22.dahlia' });
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!SECRET;
}

/**
 * Creates an Express connected account for a vendor. Returns the new account id
 * (store on vendors.stripe_account_id). Idempotent at the caller level — only
 * call when the vendor has no account yet.
 */
export async function createConnectedAccount(args: {
  businessName: string;
  email?: string | null;
}): Promise<string> {
  const account = await client().accounts.create({
    type: 'express',
    business_type: 'company',
    business_profile: {
      name: args.businessName,
      // Med spa / aesthetic services MCC.
      mcc: '7298',
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    ...(args.email ? { email: args.email } : {}),
  });
  return account.id;
}

/**
 * Hosted onboarding link — hand this URL to the vendor ("connect your bank").
 * Links are single-use and short-lived; generate fresh each time.
 */
export async function createOnboardingLink(args: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<string> {
  const link = await client().accountLinks.create({
    account: args.accountId,
    refresh_url: args.refreshUrl,
    return_url: args.returnUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

/** Express dashboard login link — where a vendor manages payouts/bank/tax. */
export async function createDashboardLink(accountId: string): Promise<string> {
  const link = await client().accounts.createLoginLink(accountId);
  return link.url;
}

export interface AccountStatus {
  /** Can accept charges + receive payouts — the "fully connected" signal. */
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

/** Current onboarding/capability state for a connected account. */
export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  const a = await client().accounts.retrieve(accountId);
  return {
    payoutsEnabled: a.payouts_enabled ?? false,
    chargesEnabled: a.charges_enabled ?? false,
    detailsSubmitted: a.details_submitted ?? false,
  };
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
}

/**
 * Creates a PaymentIntent for a deal purchase. Funds are charged to the
 * platform and HELD (no transfer_data / on_behalf_of) — the vendor is paid out
 * separately after the customer redeems. Metadata ties it back to our records.
 */
export async function createPaymentIntent(args: {
  amountCents: number;
  metadata: Record<string, string>;
}): Promise<PaymentIntentResult> {
  const pi = await client().paymentIntents.create({
    amount: args.amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: args.metadata,
  });
  return { paymentIntentId: pi.id, clientSecret: pi.client_secret! };
}

/** Minimal shape the webhook handler reads — avoids depending on Stripe.Event. */
export interface StripeWebhookEvent {
  type: string;
  data: { object: { id: string; metadata?: Record<string, string> } };
}

/** Verifies + parses a Stripe webhook event. Throws if the signature is bad. */
export function constructWebhookEvent(rawBody: string, signature: string): StripeWebhookEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  return client().webhooks.constructEvent(rawBody, signature, secret) as unknown as StripeWebhookEvent;
}
