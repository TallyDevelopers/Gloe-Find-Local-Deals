import { randomUUID } from 'node:crypto';

import type { Sql } from '../db/client';
import { writeAudit } from './audit';
import {
  createInstantPayout,
  createTransferForClaim,
  getConnectedAccountBalance,
  getInstantPayoutEligibility,
  isStripeConfigured,
  retryPayoutOnAccount,
  sumTransfersToAccount,
} from './stripe';

export class TransferRefusedError extends Error {
  constructor(public readonly reason: string) {
    super(`Transfer refused: ${reason}`);
    this.name = 'TransferRefusedError';
  }
}

interface ClaimContext {
  claim_id: string;
  claim_status: string;
  transaction_id: string;
  transaction_status: string;
  vendor_id: string;
  vendor_payout_cents: number;
  stripe_payment_intent_id: string | null;
  existing_transfer_id: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  auto_release_on_redemption: boolean;
}

async function loadClaimContext(sql: Sql, claimId: string): Promise<ClaimContext | null> {
  // claims.transaction_id is the authoritative link to the payment. (The
  // transactions.claim_id column exists in the schema but is not populated by
  // fulfillPurchase — historical drift; don't use it.)
  const rows = await sql<ClaimContext[]>`
    SELECT
      c.id                              AS claim_id,
      c.status                          AS claim_status,
      t.id                              AS transaction_id,
      t.status                          AS transaction_status,
      v.id                              AS vendor_id,
      t.vendor_payout_cents             AS vendor_payout_cents,
      t.stripe_payment_intent_id        AS stripe_payment_intent_id,
      t.stripe_transfer_id              AS existing_transfer_id,
      v.stripe_account_id               AS stripe_account_id,
      v.stripe_account_status           AS stripe_account_status,
      v.auto_release_on_redemption      AS auto_release_on_redemption
    FROM public.claims c
    JOIN public.transactions t ON t.id = c.transaction_id
    JOIN public.vendors v ON v.id = c.vendor_id
    WHERE c.id = ${claimId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Moves a vendor's share of a redeemed claim from the platform balance to
 * their connected account. Runs every routing wall before calling Stripe.
 *
 * The destination Stripe account is derived server-side from claim → vendor.
 * It is NEVER taken from a caller argument. The caller passes only the
 * claim id; we look up everything else.
 *
 * Idempotent at the Stripe layer via idempotency key (transfer_for_claim_X).
 * Idempotent at our layer because we refuse if transactions.stripe_transfer_id
 * is already set.
 *
 * Throws TransferRefusedError when a wall trips — callers should surface this
 * to the operator (vendor portal failure list / god mode failed queue).
 */
export async function releaseTransferForClaim(
  sql: Sql,
  claimId: string,
): Promise<{ transferId: string; amountCents: number; vendorId: string }> {
  const ctx = await loadClaimContext(sql, claimId);

  // Every refusal path writes an audit row before throwing. Single helper so
  // we can't accidentally skip auditing a wall-trip.
  const refuse = (reason: string): never => {
    void writeAudit(sql, {
      action: 'transfer.refused',
      claimId,
      vendorId: ctx?.vendor_id ?? null,
      transactionId: ctx?.transaction_id ?? null,
      meta: { reason },
    });
    throw new TransferRefusedError(reason);
  };

  if (!ctx) refuse('claim or transaction not found');
  if (ctx!.claim_status !== 'redeemed') refuse(`claim status is ${ctx!.claim_status}, expected redeemed`);
  if (ctx!.transaction_status !== 'paid') refuse(`transaction status is ${ctx!.transaction_status}, expected paid`);
  if (ctx!.existing_transfer_id) refuse(`transfer already exists for this claim (${ctx!.existing_transfer_id})`);
  if (!ctx!.stripe_account_id) refuse('vendor has no connected Stripe account');
  // Stripe Connect IDs are `acct_` + 16+ chars. Anything else (e.g. our old
  // `acct_test_bypass` placeholder) is a local-only marker, not a real
  // destination — refuse here instead of letting Stripe reject with "No such
  // destination" mid-flight.
  if (!/^acct_[A-Za-z0-9]{16,}$/.test(ctx!.stripe_account_id ?? '')) {
    refuse(`vendor stripe_account_id (${ctx!.stripe_account_id}) is not a real Stripe Connect account`);
  }
  if (ctx!.stripe_account_status !== 'active') refuse(`vendor stripe_account_status is ${ctx!.stripe_account_status}, expected active`);
  if (!Number.isFinite(ctx!.vendor_payout_cents) || ctx!.vendor_payout_cents <= 0) refuse(`vendor_payout_cents must be > 0 (got ${ctx!.vendor_payout_cents})`);

  // Per-attempt idempotency key. The DB wall above already prevents a
  // successful double-transfer; this key is just network-level safety to
  // ensure a single attempt doesn't accidentally produce two transfers
  // (e.g. retried HTTP request). A *new* attempt for the same claim — after
  // a failure — gets a fresh key, because Stripe locks a key to its first
  // request's exact parameters, including failures.
  const attemptKey = `transfer_${ctx!.claim_id}_${randomUUID()}`;

  let transferId: string;
  try {
    transferId = await createTransferForClaim({
      amountCents: ctx!.vendor_payout_cents,
      destinationAccountId: ctx!.stripe_account_id!,
      claimId: ctx!.claim_id,
      idempotencyKey: attemptKey,
      metadata: {
        claim_id: ctx!.claim_id,
        transaction_id: ctx!.transaction_id,
        vendor_id: ctx!.vendor_id,
        payment_intent_id: ctx!.stripe_payment_intent_id ?? '',
      },
    });
  } catch (e) {
    void writeAudit(sql, {
      action: 'transfer.refused',
      claimId,
      vendorId: ctx!.vendor_id,
      transactionId: ctx!.transaction_id,
      meta: {
        reason: 'stripe_error',
        error: e instanceof Error ? e.message : String(e),
        attemptKey,
      },
    });
    throw e;
  }

  await sql`
    UPDATE public.transactions
    SET stripe_transfer_id = ${transferId},
        status             = 'released',
        released_at        = now(),
        updated_at         = now()
    WHERE id = ${ctx!.transaction_id}
      AND stripe_transfer_id IS NULL
  `;

  void writeAudit(sql, {
    action: 'transfer.created',
    claimId,
    vendorId: ctx!.vendor_id,
    transactionId: ctx!.transaction_id,
    meta: {
      amountCents: ctx!.vendor_payout_cents,
      stripeTransferId: transferId,
      destinationAccountId: ctx!.stripe_account_id,
    },
  });

  // "You got paid" notice to the vendor (GLO-40). Lazy import mirrors the
  // sendNotification pattern and keeps email out of the money path's deps.
  // .catch so a module-load failure can never become an unhandled rejection
  // inside the money path.
  void import('./transactionalEmails')
    .then(({ sendVendorPayoutEmail }) =>
      sendVendorPayoutEmail(sql, claimId, ctx!.vendor_payout_cents, transferId),
    )
    .catch((e) => console.error('[payout email] failed:', (e as Error).message));

  return {
    transferId,
    amountCents: ctx!.vendor_payout_cents,
    vendorId: ctx!.vendor_id,
  };
}

export class InstantPayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstantPayoutError';
  }
}

/**
 * Snapshot of everything the Hub needs to render the "Pay me now" experience.
 * Combines our DB flag + live Stripe state in one call so the UI can decide
 * what to show: opt-in toggle, add-debit-card CTA, or payout button.
 */
export async function getInstantPayoutStatus(
  sql: Sql,
  vendorId: string,
): Promise<{
  optedIn: boolean;
  eligible: boolean;
  reason: string | null;
  availableCents: number;
  feePercent: number; // bps style would be cleaner; using % for direct UI display
}> {
  const feePercent = 3;
  const rows = await sql<{ stripe_account_id: string | null; instant_payout_enabled: boolean }[]>`
    SELECT stripe_account_id, instant_payout_enabled
    FROM public.vendors WHERE id = ${vendorId} LIMIT 1
  `;
  const v = rows[0];
  if (!v) throw new Error('Vendor not found');

  if (!v.stripe_account_id || !isStripeConfigured()) {
    return {
      optedIn: v.instant_payout_enabled,
      eligible: false,
      reason: 'Connect your Stripe account first.',
      availableCents: 0,
      feePercent,
    };
  }

  try {
    const [eligibility, balance] = await Promise.all([
      getInstantPayoutEligibility(v.stripe_account_id),
      getConnectedAccountBalance(v.stripe_account_id),
    ]);
    return {
      optedIn: v.instant_payout_enabled,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      availableCents: balance.availableCents,
      feePercent,
    };
  } catch {
    return {
      optedIn: v.instant_payout_enabled,
      eligible: false,
      reason: 'Could not reach Stripe. Try again in a moment.',
      availableCents: 0,
      feePercent,
    };
  }
}

/**
 * Fires an Instant Payout from the vendor's available Connect balance to
 * their default debit card. The 3% application fee is auto-applied by
 * Stripe (configured in dashboard); we don't compute it ourselves. Stripe
 * deducts its own 1% from the fee, leaving Gloē ~2% net.
 *
 * Returns the application-fee amount Stripe charged so the UI can confirm
 * the math to the vendor. Writes a `payouts` row with status='pending';
 * the payout.* webhook will flip it to 'paid' or 'failed'.
 */
export async function triggerInstantPayout(
  sql: Sql,
  vendorId: string,
  amountCents: number,
  actorUserId: string,
  requestId: string,
): Promise<{ payoutId: string; amountCents: number; feeCents: number }> {
  const refuse = (reason: string): never => {
    void writeAudit(sql, {
      action: 'instant_payout.refused',
      vendorId,
      actorUserId,
      meta: { reason, amountCents },
    });
    throw new InstantPayoutError(reason);
  };

  if (amountCents <= 0) refuse('Amount must be positive.');
  if (!/^[A-Za-z0-9_-]{12,80}$/.test(requestId)) refuse('Invalid payout request id.');

  const rows = await sql<{
    stripe_account_id: string | null;
    instant_payout_enabled: boolean;
    stripe_account_status: string | null;
  }[]>`
    SELECT stripe_account_id, instant_payout_enabled, stripe_account_status
    FROM public.vendors WHERE id = ${vendorId} LIMIT 1
  `;
  const v = rows[0];
  if (!v) refuse('Vendor not found.');
  if (!v!.instant_payout_enabled) refuse('Instant payouts are off for this vendor.');
  if (!v!.stripe_account_id) refuse('No Stripe account.');
  if (v!.stripe_account_status !== 'active') refuse('Stripe account not active.');

  const eligibility = await getInstantPayoutEligibility(v!.stripe_account_id!);
  if (!eligibility.eligible) refuse(eligibility.reason ?? 'Not eligible.');

  const balance = await getConnectedAccountBalance(v!.stripe_account_id!);
  if (amountCents > balance.availableCents) {
    refuse(`Only $${(balance.availableCents / 100).toFixed(2)} is available to pay out instantly.`);
  }

  const idempotencyKey = `instant_payout_${vendorId}_${requestId}`;
  let payoutId: string;
  try {
    const res = await createInstantPayout({
      amountCents,
      accountId: v!.stripe_account_id!,
      idempotencyKey,
      metadata: { vendor_id: vendorId, request_id: requestId, source: 'gloe_vendor_hub' },
    });
    payoutId = res.payoutId;
  } catch (e) {
    void writeAudit(sql, {
      action: 'instant_payout.refused',
      vendorId,
      actorUserId,
      meta: { reason: 'stripe_error', error: e instanceof Error ? e.message : String(e), amountCents },
    });
    throw e;
  }

  // 3% application fee — Stripe applies this automatically per the dashboard
  // pricing scheme. We compute it here for our records + UI confirmation;
  // it's not in the API response of the create call.
  const feeCents = Math.round(amountCents * 0.03);

  await sql`
    INSERT INTO public.payouts (
      vendor_id, stripe_payout_id, amount_cents, currency, status, created_at
    ) VALUES (
      ${vendorId}, ${payoutId}, ${amountCents}, 'usd', 'pending', now()
    )
    ON CONFLICT (stripe_payout_id) DO NOTHING
  `;

  void writeAudit(sql, {
    action: 'instant_payout.requested',
    vendorId,
    actorUserId,
    meta: { amountCents, feeCents, stripePayoutId: payoutId, requestId },
  });

  return { payoutId, amountCents, feeCents };
}

/**
 * Retry a failed payout. Stripe doesn't have "retry this payout" — we create
 * a fresh payout on the connected account for the same amount, fresh
 * idempotency key. Original `payouts` row stays as the history.
 */
export async function retryFailedPayout(
  sql: Sql,
  payoutId: string,
  actorUserId: string,
): Promise<{ newPayoutId: string }> {
  const rows = await sql<{
    vendor_id: string;
    amount_cents: number;
    status: string;
    stripe_account_id: string | null;
  }[]>`
    SELECT p.vendor_id, p.amount_cents, p.status, v.stripe_account_id
    FROM public.payouts p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.id = ${payoutId} LIMIT 1
  `;
  const p = rows[0];
  if (!p) throw new Error('Payout not found.');
  if (p.status !== 'failed') throw new Error(`Payout is ${p.status}; only failed payouts can be retried.`);
  if (!p.stripe_account_id) throw new Error('Vendor has no Stripe account.');

  const idempotencyKey = `retry_payout_${payoutId}_${Date.now()}_${randomUUID()}`;
  const { payoutId: newId } = await retryPayoutOnAccount({
    accountId: p.stripe_account_id,
    amountCents: p.amount_cents,
    idempotencyKey,
    metadata: { retry_of_payout_id: payoutId, vendor_id: p.vendor_id },
  });

  // New payouts row will be created by the payout.created webhook. Mark
  // the old one so we don't try again.
  await sql`
    UPDATE public.payouts
    SET status = 'cancelled', updated_at = now()
    WHERE id = ${payoutId} AND status = 'failed'
  `;

  void writeAudit(sql, {
    action: 'payout.created',
    actorUserId,
    vendorId: p.vendor_id,
    payoutId,
    meta: { retried: true, newStripePayoutId: newId, amountCents: p.amount_cents },
  });

  return { newPayoutId: newId };
}

/**
 * Reconciliation: compare what our DB thinks we transferred to a vendor
 * vs. what Stripe says actually landed. Delta > 0 = we think we sent more
 * than Stripe shows (investigate); delta < 0 = Stripe sent more than we
 * recorded (also investigate, missed webhook?).
 */
export async function reconcileVendorTransfers(sql: Sql, vendorId: string): Promise<{
  dbTransferredCents: number;
  dbTransferCount: number;
  stripeSentCents: number;
  stripeReversedCents: number;
  stripeNetCents: number;
  stripeTransferCount: number;
  deltaCents: number;
  isReconciled: boolean;
}> {
  const rows = await sql<{ total: number; count: number; account: string | null }[]>`
    SELECT
      COALESCE(SUM(t.vendor_payout_cents), 0)::int AS total,
      COUNT(*)::int AS count,
      (SELECT stripe_account_id FROM public.vendors WHERE id = ${vendorId}) AS account
    FROM public.transactions t
    WHERE t.vendor_id = ${vendorId} AND t.stripe_transfer_id IS NOT NULL
  `;
  const r = rows[0]!;
  if (!r.account) {
    return {
      dbTransferredCents: r.total,
      dbTransferCount: r.count,
      stripeSentCents: 0,
      stripeReversedCents: 0,
      stripeNetCents: 0,
      stripeTransferCount: 0,
      deltaCents: r.total,
      isReconciled: r.total === 0,
    };
  }
  const live = await sumTransfersToAccount(r.account);
  const delta = r.total - live.netCents;
  return {
    dbTransferredCents: r.total,
    dbTransferCount: r.count,
    stripeSentCents: live.totalSentCents,
    stripeReversedCents: live.reversedCents,
    stripeNetCents: live.netCents,
    stripeTransferCount: live.count,
    deltaCents: delta,
    isReconciled: Math.abs(delta) === 0,
  };
}

/** Used by the dev redeem path to decide whether to auto-fire the transfer. */
export async function shouldAutoReleaseForClaim(
  sql: Sql,
  claimId: string,
): Promise<boolean> {
  const rows = await sql<{ auto_release: boolean }[]>`
    SELECT v.auto_release_on_redemption AS auto_release
    FROM public.claims c
    JOIN public.vendors v ON v.id = c.vendor_id
    WHERE c.id = ${claimId}
    LIMIT 1
  `;
  return rows[0]?.auto_release ?? false;
}
