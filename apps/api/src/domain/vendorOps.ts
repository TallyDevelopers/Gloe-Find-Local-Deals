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
