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

/**
 * Stripe's view of a connected account's onboarding/capability state, beyond
 * just `payouts_enabled`. Surfaces the exact requirements Stripe is asking
 * the vendor for — currently_due / past_due / disabled_reason — so god mode
 * can translate "your account is restricted" into "Stripe needs your DOB."
 */
export async function getConnectedAccountRequirements(accountId: string): Promise<{
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  currentlyDue: string[];
  pastDue: string[];
  eventuallyDue: string[];
  externalAccounts: Array<{ id: string; type: 'bank_account' | 'card'; last4?: string | null; brand?: string | null; funding?: string | null }>;
}> {
  const account = await client().accounts.retrieve(accountId);
  const req = account.requirements;
  const external = await client().accounts.listExternalAccounts(accountId, { limit: 10 });
  return {
    payoutsEnabled: account.payouts_enabled ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    disabledReason: req?.disabled_reason ?? null,
    currentlyDue: req?.currently_due ?? [],
    pastDue: req?.past_due ?? [],
    eventuallyDue: req?.eventually_due ?? [],
    externalAccounts: external.data.map((e) => {
      if (e.object === 'card') {
        const c = e as { id: string; last4?: string; brand?: string; funding?: string };
        return { id: c.id, type: 'card' as const, last4: c.last4 ?? null, brand: c.brand ?? null, funding: c.funding ?? null };
      }
      const b = e as { id: string; last4?: string; bank_name?: string };
      return { id: b.id, type: 'bank_account' as const, last4: b.last4 ?? null, brand: b.bank_name ?? null };
    }),
  };
}

/**
 * Retry a failed payout (Stripe's `payouts.create` on the connected account
 * is the only way — there's no "retry the same payout id" API). Caller picks
 * the amount from our records.
 */
export async function retryPayoutOnAccount(args: {
  accountId: string;
  amountCents: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}): Promise<{ payoutId: string; arrivalDate: number | null }> {
  const payout = await client().payouts.create(
    {
      amount: args.amountCents,
      currency: 'usd',
      metadata: args.metadata ?? {},
    },
    { stripeAccount: args.accountId, idempotencyKey: args.idempotencyKey },
  );
  return { payoutId: payout.id, arrivalDate: payout.arrival_date };
}

/**
 * Sum of all transfers we've ever sent to a connected account, minus
 * reversals. Used by the reconciliation panel to diff against our DB.
 * Paginates if needed (very rare at our scale).
 */
export async function sumTransfersToAccount(accountId: string): Promise<{
  totalSentCents: number;
  reversedCents: number;
  netCents: number;
  count: number;
}> {
  let totalSent = 0;
  let reversed = 0;
  let count = 0;
  let lastId: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page: { data: Array<{ id: string; amount: number; amount_reversed: number }>; has_more: boolean } =
      await client().transfers.list({
        destination: accountId,
        limit: 100,
        ...(lastId ? { starting_after: lastId } : {}),
      });
    for (const t of page.data) {
      totalSent += t.amount;
      reversed += t.amount_reversed;
      count += 1;
      lastId = t.id;
    }
    if (!page.has_more) break;
  }
  return { totalSentCents: totalSent, reversedCents: reversed, netCents: totalSent - reversed, count };
}

/**
 * Live balance on a connected account: what Stripe is holding for the vendor
 * (available = ready to be paid out / instantly paid out, pending = still in
 * Stripe's hold window before becoming available). Currency assumed USD —
 * we sum across all USD entries in case Stripe ever splits them.
 */
export async function getConnectedAccountBalance(
  accountId: string,
): Promise<{ availableCents: number; pendingCents: number }> {
  const balance = await client().balance.retrieve(undefined, { stripeAccount: accountId });
  const sumUsd = (entries: { amount: number; currency: string }[] | undefined) =>
    (entries ?? []).filter((e) => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);
  return {
    availableCents: sumUsd(balance.available),
    pendingCents: sumUsd(balance.pending),
  };
}

/**
 * Live balance on the Gloe platform Stripe account: customer charges land here,
 * vendor transfers come out of here, refunds go back to customers from here.
 * Available = ready to sweep to Gloe's bank. Pending = still in Stripe's
 * settlement window (typical T+2 for US cards). Sums across USD entries.
 */
export async function getPlatformBalance(): Promise<{ availableCents: number; pendingCents: number }> {
  const balance = await client().balance.retrieve();
  const sumUsd = (entries: { amount: number; currency: string }[] | undefined) =>
    (entries ?? []).filter((e) => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);
  return {
    availableCents: sumUsd(balance.available),
    pendingCents: sumUsd(balance.pending),
  };
}

/**
 * Whether a connected account is eligible for Instant Payouts: needs a
 * default external debit card (not just a bank account) and active capabilities.
 */
export async function getInstantPayoutEligibility(
  accountId: string,
): Promise<{ eligible: boolean; reason: string | null; hasDebitCard: boolean }> {
  const account = await client().accounts.retrieve(accountId);
  if (!account.payouts_enabled) {
    return { eligible: false, reason: 'Stripe onboarding incomplete.', hasDebitCard: false };
  }
  const externalAccounts = await client().accounts.listExternalAccounts(accountId, {
    object: 'card',
    limit: 10,
  });
  const hasDebitCard = externalAccounts.data.some(
    (c) => c.object === 'card' && (c as { funding?: string }).funding === 'debit',
  );
  if (!hasDebitCard) {
    return {
      eligible: false,
      reason: 'Add a debit card in your Stripe dashboard to enable Instant Payouts.',
      hasDebitCard: false,
    };
  }
  return { eligible: true, reason: null, hasDebitCard: true };
}

/**
 * Triggers an Instant Payout from the connected account's available balance
 * to the vendor's default debit card. The application-fee percentage is
 * configured in the Stripe Dashboard's default pricing scheme (currently 3%);
 * Stripe deducts it automatically and routes it back to the platform balance.
 *
 * Stripe additionally deducts its own 1% cost from the application fee.
 * Net to Gloē: 2% per instant payout. See CREDITS_AND_FEES.md §1b.
 */
export async function createInstantPayout(args: {
  amountCents: number;
  accountId: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<{ payoutId: string; arrivalDate: number | null }> {
  const payout = await client().payouts.create(
    {
      amount: args.amountCents,
      currency: 'usd',
      method: 'instant',
      metadata: args.metadata,
    },
    { stripeAccount: args.accountId, idempotencyKey: args.idempotencyKey },
  );
  return { payoutId: payout.id, arrivalDate: payout.arrival_date };
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

/**
 * Moves money from the platform balance to a connected vendor's balance.
 * Called once a `claim` has flipped to redeemed and all routing walls have
 * passed (see domain/payouts.ts).
 *
 * Idempotency: the caller passes a per-attempt key. Two layers of safety:
 *  1. We refuse in our own DB walls (transactions.stripe_transfer_id IS NULL)
 *     before this is ever called → blocks accidental double-fires.
 *  2. Stripe's idempotency key blocks the same network call from creating two
 *     transfers within Stripe's 24h cache window.
 * Per-attempt (not per-claim) means a transient failure can be safely retried
 * with a new key — important because Stripe locks a key to its first request's
 * parameters, including ones that fail.
 */
export async function createTransferForClaim(args: {
  amountCents: number;
  destinationAccountId: string;
  claimId: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<string> {
  const transfer = await client().transfers.create(
    {
      amount: args.amountCents,
      currency: 'usd',
      destination: args.destinationAccountId,
      transfer_group: args.claimId,
      metadata: args.metadata,
    },
    { idempotencyKey: args.idempotencyKey },
  );
  return transfer.id;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Creates a Stripe-hosted Checkout Session for a "share to pay" purchase.
 * Used when the in-app customer wants someone else to pay (e.g. partner /
 * parent) — they generate a link, send it, the payer completes checkout on
 * Stripe's hosted page. Funds land on the platform balance and are held the
 * same way as in-app charges; the vendor is paid out separately after
 * redemption (no transfer_data here).
 *
 * Metadata mirrors createPaymentIntent so the same `fulfillPurchase` code
 * path can credit the voucher to the original (redeemer) user on success.
 *
 * 3DS is left to Stripe Radar to decide (automatic), which is the right
 * default for a shared-link flow — Stripe sees the elevated risk and prompts
 * authentication on its own, shifting liability to the issuing bank.
 */
export async function createGiftCheckoutSession(args: {
  amountCents: number;
  productName: string;
  /** Vendor name + variant label, shown under the product name on Stripe checkout. */
  productDescription: string;
  /** Photo of the deal, shown on the Stripe checkout page. Optional. */
  productImageUrl?: string | null;
  /** Where Stripe sends the payer after success — our hosted "done" page. */
  successUrl: string;
  /** Where Stripe sends the payer if they back out. */
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<CheckoutSessionResult> {
  const session = await client().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: args.amountCents,
          product_data: {
            name: args.productName,
            description: args.productDescription,
            ...(args.productImageUrl ? { images: [args.productImageUrl] } : {}),
          },
        },
        quantity: 1,
      },
    ],
    // Capture payer identity — we record these on the transaction so we know
    // who actually paid (not just who redeems).
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: false },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: args.metadata,
    payment_intent_data: {
      // The PaymentIntent inherits the same metadata so the existing
      // payment_intent.succeeded webhook can still fulfill if Stripe fires
      // that event before checkout.session.completed (rare, but possible).
      metadata: args.metadata,
    },
  });
  if (!session.url) throw new Error('Stripe did not return a Checkout Session URL');
  return { sessionId: session.id, url: session.url };
}

/**
 * Fetches a Checkout Session for the gift-link landing page. Returns just the
 * fields we render (status, line item, image, amount). Throws if not found.
 */
export async function retrieveCheckoutSession(sessionId: string): Promise<{
  id: string;
  status: 'open' | 'complete' | 'expired' | null;
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required' | null;
  amountTotalCents: number | null;
  metadata: Record<string, string>;
  url: string | null;
}> {
  const session = await client().checkout.sessions.retrieve(sessionId);
  return {
    id: session.id,
    status: (session.status as 'open' | 'complete' | 'expired' | null) ?? null,
    paymentStatus: (session.payment_status as 'paid' | 'unpaid' | 'no_payment_required' | null) ?? null,
    amountTotalCents: session.amount_total ?? null,
    metadata: (session.metadata as Record<string, string> | null) ?? {},
    url: session.url ?? null,
  };
}

/** Minimal shape the webhook handler reads — avoids depending on Stripe.Event. */
export interface StripeWebhookEvent {
  type: string;
  /** Present on Connect events. Identifies which connected account the event is for. */
  account?: string;
  data: {
    object: {
      id: string;
      metadata?: Record<string, string>;
      [key: string]: unknown;
    };
  };
}

/** Verifies + parses a Stripe webhook event. Throws if the signature is bad. */
export function constructWebhookEvent(rawBody: string, signature: string): StripeWebhookEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  return client().webhooks.constructEvent(rawBody, signature, secret) as unknown as StripeWebhookEvent;
}
