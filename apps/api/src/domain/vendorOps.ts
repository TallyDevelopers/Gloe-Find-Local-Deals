import StripeNode from 'stripe';

import type { Sql } from '../db/client';
import { writeAudit } from './audit';
import { setVendorSuspended } from './admin';

const SECRET = process.env.STRIPE_SECRET_KEY;
type StripeClient = InstanceType<typeof StripeNode>;
let _stripe: StripeClient | null = null;
function stripe(): StripeClient {
  if (!SECRET) throw new Error('Stripe not configured');
  if (!_stripe) _stripe = new StripeNode(SECRET, { apiVersion: '2026-04-22.dahlia' });
  return _stripe;
}

/**
 * Pre-redemption refund of a single transaction. Refunds the PaymentIntent
 * on Stripe, marks the voucher `cancelled` and the transaction `refunded`.
 *
 * Walls:
 *   - Claim must be `active` (we don't unwind delivered services here —
 *     post-redemption refunds require transfer reversals; punt).
 *   - Transaction must be `paid` (we don't refund what we never received).
 *   - Must have a Stripe PaymentIntent id.
 *
 * Audit row written on success AND failure.
 */
export async function refundClaim(
  sql: Sql,
  claimId: string,
  actorUserId: string | null,
  reason: string,
): Promise<{ refunded: boolean; stripeRefundId: string | null; error: string | null }> {
  const rows = await sql<{
    claim_id: string;
    claim_status: string;
    tx_id: string;
    tx_status: string;
    vendor_id: string;
    pi_id: string | null;
    amount_cents: number;
  }[]>`
    SELECT
      c.id AS claim_id, c.status AS claim_status,
      t.id AS tx_id, t.status AS tx_status,
      c.vendor_id, t.stripe_payment_intent_id AS pi_id,
      t.consumer_paid_cents AS amount_cents
    FROM public.claims c
    JOIN public.transactions t ON t.id = c.transaction_id
    WHERE c.id = ${claimId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return audit('claim_not_found');
  if (r.claim_status !== 'active') return audit(`claim is ${r.claim_status}, only active claims can be refunded here`);
  if (r.tx_status !== 'paid')      return audit(`transaction is ${r.tx_status}, expected paid`);
  if (!r.pi_id)                    return audit('no Stripe PaymentIntent on this transaction');

  let refundId: string;
  try {
    const refund = await stripe().refunds.create(
      { payment_intent: r.pi_id, reason: 'requested_by_customer', metadata: { gloe_reason: reason, claim_id: claimId } },
      { idempotencyKey: `refund_claim_${claimId}` },
    );
    refundId = refund.id;
  } catch (e) {
    return audit(`stripe refund failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  await sql`
    UPDATE public.claims SET status = 'cancelled' WHERE id = ${claimId}
  `;
  await sql`
    UPDATE public.transactions
    SET status = 'refunded', refunded_at = now(), updated_at = now()
    WHERE id = ${r.tx_id}
  `;

  void writeAudit(sql, {
    action: 'refund.issued',
    actorUserId,
    vendorId: r.vendor_id,
    claimId,
    transactionId: r.tx_id,
    meta: { stripeRefundId: refundId, amountCents: r.amount_cents, reason },
  });

  return { refunded: true, stripeRefundId: refundId, error: null };

  function audit(err: string): { refunded: false; stripeRefundId: null; error: string } {
    void writeAudit(sql, {
      action: 'refund.refused',
      actorUserId,
      vendorId: r?.vendor_id ?? null,
      claimId,
      transactionId: r?.tx_id ?? null,
      meta: { reason: err, attemptedRefundReason: reason },
    });
    return { refunded: false, stripeRefundId: null, error: err };
  }
}

/**
 * Refund a transaction by amount. Supports both full and partial refunds, and
 * is the entry point for admin-issued refunds from the Customers / Transactions
 * console. Distinct from `refundClaim` above (which is the wind-down primitive
 * keyed on the claim, no partial support).
 *
 * Eligibility:
 *   - Claim must be `active` or `expired` (never redeemed).
 *   - Transaction must be `paid` or `partially_refunded`.
 *   - amount must be > 0 and ≤ remaining refundable (paid - already_refunded).
 *
 * Money flow:
 *   - Refunds via Stripe PaymentIntent. We do NOT refund our platform fee —
 *     Stripe Connect default. Vendor's share is reversed back to us; we keep
 *     our cut. Matches Groupon's model and avoids paying Stripe's ~3% out of
 *     our own pocket on every refund.
 *   - Voucher is `cancelled` on FULL refund, stays alive on partial (customer
 *     can still redeem for the kept portion).
 *   - Transaction status flips to `refunded` (full) or `partially_refunded`.
 *
 * Idempotency: keyed on `txn + cumulative_refunded_before` so retries of the
 * same refund don't double-charge, but a follow-up partial in the same minute
 * still goes through.
 *
 * Race safety: Stripe's idempotency key (keyed on `txn + refunded_cents_before`)
 * dedupes any double-clicks, and the DB CHECK `refunded_cents <= consumer_paid_cents`
 * prevents over-refund. A concurrent redemption between our eligibility read
 * and the Stripe call is the only edge case — caller should be a human admin
 * with seconds between actions, and the audit log will show both events.
 */
export async function refundTransaction(
  sql: Sql,
  transactionId: string,
  amountCents: number,
  actorUserId: string,
  reason: string,
): Promise<{ refunded: boolean; stripeRefundId: string | null; amountCents: number; isFullRefund: boolean; error: string | null }> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return audit('amount must be > 0', null, null, null);
  }
  if (!reason || reason.trim().length === 0) {
    return audit('reason is required', null, null, null);
  }

  const rows = await sql<{
    claim_id: string;
    claim_status: string;
    tx_id: string;
    tx_status: string;
    vendor_id: string;
    pi_id: string | null;
    consumer_paid_cents: number;
    refunded_cents: number;
  }[]>`
    SELECT
      c.id  AS claim_id,
      c.status AS claim_status,
      t.id  AS tx_id,
      t.status AS tx_status,
      c.vendor_id,
      t.stripe_payment_intent_id AS pi_id,
      t.consumer_paid_cents,
      t.refunded_cents
    FROM public.transactions t
    JOIN public.claims c ON c.transaction_id = t.id
    WHERE t.id = ${transactionId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return audit('transaction_or_claim_not_found', null, null, null);
  if (!['active', 'expired'].includes(r.claim_status)) {
    return audit(`claim is ${r.claim_status}, only active or expired (unredeemed) claims can be refunded`, r.vendor_id, r.claim_id, r.tx_id);
  }
  if (!['paid', 'partially_refunded'].includes(r.tx_status)) {
    return audit(`transaction is ${r.tx_status}, expected paid or partially_refunded`, r.vendor_id, r.claim_id, r.tx_id);
  }
  if (!r.pi_id) {
    return audit('no Stripe PaymentIntent on this transaction', r.vendor_id, r.claim_id, r.tx_id);
  }
  const remaining = r.consumer_paid_cents - r.refunded_cents;
  if (amountCents > remaining) {
    return audit(`amount ${amountCents} exceeds refundable balance ${remaining}`, r.vendor_id, r.claim_id, r.tx_id);
  }

  const isFullRefund = amountCents === remaining;

  let refundId: string;
  try {
    const refund = await stripe().refunds.create(
      {
        payment_intent: r.pi_id!,
        amount: amountCents,
        reason: 'requested_by_customer',
        // We keep our platform fee on refunds — see fn docs.
        refund_application_fee: false,
        metadata: { gloe_reason: reason, transaction_id: transactionId, claim_id: r.claim_id },
      },
      { idempotencyKey: `refund_txn_${transactionId}_${r.refunded_cents}` },
    );
    refundId = refund.id;
  } catch (e) {
    return audit(`stripe refund failed: ${e instanceof Error ? e.message : String(e)}`, r.vendor_id, r.claim_id, r.tx_id);
  }

  const newRefundedCents = r.refunded_cents + amountCents;
  const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

  await sql`
    UPDATE public.transactions
    SET status         = ${newStatus},
        refunded_cents = ${newRefundedCents},
        refunded_at    = COALESCE(refunded_at, now()),
        updated_at     = now()
    WHERE id = ${r.tx_id}
  `;
  if (isFullRefund) {
    // Kill the voucher only on a full refund. Partial refunds leave the
    // voucher live so the customer can still redeem the kept portion.
    await sql`UPDATE public.claims SET status = 'cancelled' WHERE id = ${r.claim_id}`;
  }

  void writeAudit(sql, {
    action: isFullRefund ? 'refund.issued' : 'refund.partial',
    actorUserId,
    vendorId: r.vendor_id,
    claimId: r.claim_id,
    transactionId: r.tx_id,
    meta: {
      stripeRefundId: refundId,
      amountCents,
      cumulativeRefundedCents: newRefundedCents,
      consumerPaidCents: r.consumer_paid_cents,
      reason,
    },
  });

  return { refunded: true, stripeRefundId: refundId, amountCents, isFullRefund, error: null };

  function audit(err: string, vendorId: string | null, claimId: string | null, txId: string | null) {
    void writeAudit(sql, {
      action: 'refund.refused',
      actorUserId,
      vendorId,
      claimId,
      transactionId: txId,
      meta: { reason: err, attemptedAmountCents: amountCents, attemptedRefundReason: reason },
    });
    return { refunded: false as const, stripeRefundId: null, amountCents, isFullRefund: false, error: err };
  }
}

/**
 * Force-refund a transaction whose voucher has ALREADY been redeemed.
 *
 * This is the deliberate, money-moving sibling of `refundTransaction` (which
 * refuses redeemed claims). Use it for the "customer redeemed, then disputed /
 * we comped them" case. Two things happen:
 *   1. Refund the customer's PaymentIntent (full or partial). We keep our
 *      platform fee (`refund_application_fee: false`), same as normal refunds.
 *   2. If the vendor already received their transfer (redeemed → released),
 *      claw it back with a proportional Stripe transfer reversal so the platform
 *      isn't left funding the refund. Reversal can push the vendor's Connect
 *      balance negative — Stripe recovers it from their future charges. Pass
 *      `reverseTransfer: false` to eat it on the platform instead (a comp).
 *
 * The voucher itself stays `redeemed` — the service was delivered; we're only
 * unwinding money. Transaction flips to refunded / partially_refunded.
 *
 * Owner-gated at the router. Every outcome is audited.
 */
export async function forceRefundRedeemed(
  sql: Sql,
  transactionId: string,
  amountCents: number,
  actorUserId: string,
  reason: string,
  reverseTransfer: boolean,
): Promise<{ refunded: boolean; stripeRefundId: string | null; reversedCents: number; amountCents: number; isFullRefund: boolean; error: string | null }> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return fail('amount must be > 0', null, null, null);
  if (!reason || reason.trim().length === 0) return fail('reason is required', null, null, null);

  const rows = await sql<{
    claim_id: string;
    claim_status: string;
    tx_id: string;
    tx_status: string;
    vendor_id: string;
    pi_id: string | null;
    transfer_id: string | null;
    consumer_paid_cents: number;
    vendor_payout_cents: number;
    refunded_cents: number;
  }[]>`
    SELECT
      c.id AS claim_id, c.status AS claim_status,
      t.id AS tx_id, t.status AS tx_status, c.vendor_id,
      t.stripe_payment_intent_id AS pi_id, t.stripe_transfer_id AS transfer_id,
      t.consumer_paid_cents, t.vendor_payout_cents, t.refunded_cents
    FROM public.transactions t
    JOIN public.claims c ON c.transaction_id = t.id
    WHERE t.id = ${transactionId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return fail('transaction_or_claim_not_found', null, null, null);
  if (!['paid', 'partially_refunded', 'released'].includes(r.tx_status)) {
    return fail(`transaction is ${r.tx_status}, cannot force-refund`, r.vendor_id, r.claim_id, r.tx_id);
  }
  if (!r.pi_id) return fail('no Stripe PaymentIntent on this transaction', r.vendor_id, r.claim_id, r.tx_id);
  const remaining = r.consumer_paid_cents - r.refunded_cents;
  if (amountCents > remaining) {
    return fail(`amount ${amountCents} exceeds refundable balance ${remaining}`, r.vendor_id, r.claim_id, r.tx_id);
  }
  const isFullRefund = amountCents === remaining;

  // 1) Refund the customer.
  let refundId: string;
  try {
    const refund = await stripe().refunds.create(
      {
        payment_intent: r.pi_id,
        amount: amountCents,
        reason: 'requested_by_customer',
        refund_application_fee: false,
        metadata: { gloe_reason: reason, transaction_id: transactionId, claim_id: r.claim_id, redeemed: 'true' },
      },
      { idempotencyKey: `force_refund_txn_${transactionId}_${r.refunded_cents}` },
    );
    refundId = refund.id;
  } catch (e) {
    return fail(`stripe refund failed: ${e instanceof Error ? e.message : String(e)}`, r.vendor_id, r.claim_id, r.tx_id);
  }

  // 2) Claw back the vendor's proportional share, if asked and a transfer exists.
  let reversedCents = 0;
  if (reverseTransfer && r.transfer_id && r.vendor_payout_cents > 0) {
    reversedCents = Math.round((amountCents * r.vendor_payout_cents) / r.consumer_paid_cents);
    if (reversedCents > 0) {
      try {
        await stripe().transfers.createReversal(
          r.transfer_id,
          { amount: reversedCents, metadata: { gloe_reason: reason, transaction_id: transactionId } },
          { idempotencyKey: `force_reverse_txn_${transactionId}_${r.refunded_cents}` },
        );
      } catch (e) {
        // Refund already went through; surface the reversal failure but don't
        // unwind the customer refund. Audit captures the partial outcome.
        reversedCents = 0;
        void writeAudit(sql, {
          action: 'refund.refused',
          actorUserId, vendorId: r.vendor_id, claimId: r.claim_id, transactionId: r.tx_id,
          meta: { stage: 'transfer_reversal', error: e instanceof Error ? e.message : String(e), refundIssued: refundId },
        });
      }
    }
  }

  const newRefundedCents = r.refunded_cents + amountCents;
  const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';
  await sql`
    UPDATE public.transactions
    SET status = ${newStatus}, refunded_cents = ${newRefundedCents},
        refunded_at = COALESCE(refunded_at, now()), updated_at = now()
    WHERE id = ${r.tx_id}
  `;

  void writeAudit(sql, {
    action: isFullRefund ? 'refund.issued' : 'refund.partial',
    actorUserId, vendorId: r.vendor_id, claimId: r.claim_id, transactionId: r.tx_id,
    meta: {
      stripeRefundId: refundId, amountCents, reversedCents,
      cumulativeRefundedCents: newRefundedCents, consumerPaidCents: r.consumer_paid_cents,
      redeemedForceRefund: true, reverseTransfer, reason,
    },
  });

  return { refunded: true, stripeRefundId: refundId, reversedCents, amountCents, isFullRefund, error: null };

  function fail(err: string, vendorId: string | null, claimId: string | null, txId: string | null) {
    void writeAudit(sql, {
      action: 'refund.refused',
      actorUserId, vendorId, claimId, transactionId: txId,
      meta: { reason: err, redeemedForceRefund: true, attemptedAmountCents: amountCents, attemptedRefundReason: reason },
    });
    return { refunded: false as const, stripeRefundId: null, reversedCents: 0, amountCents, isFullRefund: false, error: err };
  }
}

/**
 * The "wind down a vendor" button. For one vendor:
 *   1. Refund every active (unredeemed) claim.
 *   2. Suspend the vendor (pulls live deals → draft).
 *
 * Returns a per-claim report so the UI can show what worked / what didn't.
 * Idempotent: re-running skips claims that have already been cancelled.
 */
export async function windDownVendor(
  sql: Sql,
  vendorId: string,
  actorUserId: string,
  reason: string,
): Promise<{
  refunded: Array<{ claimId: string; amountCents: number; stripeRefundId: string }>;
  failed: Array<{ claimId: string; error: string }>;
  suspended: boolean;
}> {
  const claims = await sql<{ id: string; amount_cents: number }[]>`
    SELECT c.id, t.consumer_paid_cents AS amount_cents
    FROM public.claims c
    JOIN public.transactions t ON t.id = c.transaction_id
    WHERE c.vendor_id = ${vendorId}
      AND c.status = 'active'
      AND t.status = 'paid'
  `;

  const refunded: Array<{ claimId: string; amountCents: number; stripeRefundId: string }> = [];
  const failed: Array<{ claimId: string; error: string }> = [];

  for (const c of claims) {
    const result = await refundClaim(sql, c.id, actorUserId, reason);
    if (result.refunded && result.stripeRefundId) {
      refunded.push({ claimId: c.id, amountCents: c.amount_cents, stripeRefundId: result.stripeRefundId });
    } else {
      failed.push({ claimId: c.id, error: result.error ?? 'unknown' });
    }
  }

  await setVendorSuspended(sql, vendorId, true);
  void writeAudit(sql, {
    action: 'vendor.suspended',
    actorUserId,
    vendorId,
    meta: { reason, viaWindDown: true, refundedCount: refunded.length, failedCount: failed.length },
  });

  return { refunded, failed, suspended: true };
}
