import { randomBytes, randomUUID } from 'node:crypto';

import type { Sql } from '../db/client';
import { computeFee } from './fees';
import { createPaymentIntent } from './stripe';

export interface CreatePurchaseResult {
  clientSecret: string;
  paymentIntentId: string;
  transactionId: string;
  amountCents: number;
}

const MAX_QTY = 10;

/**
 * Starts a purchase of `quantity` of one deal option (same vendor, one charge).
 * Computes the fee on the total, creates a held PaymentIntent, and records a
 * `pending_payment` transaction. Vouchers (claims) are created on payment
 * success — one per quantity — so an unpaid order never yields a live voucher.
 */
export async function createPurchase(
  sql: Sql,
  args: { userId: string; variantId: string; quantity: number },
): Promise<CreatePurchaseResult> {
  const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(args.quantity)));

  const rows = await sql<{
    variant_id: string;
    deal_id: string;
    vendor_id: string;
    deal_price_cents: number;
    spots_total: number | null;
    spots_claimed: number;
    deal_status: string;
    per_customer_limit: number;
    lifetime_limit_per_customer: number | null;
  }[]>`
    SELECT dv.id AS variant_id, d.id AS deal_id, d.vendor_id,
           dv.deal_price_cents, dv.spots_total, dv.spots_claimed,
           d.status AS deal_status, d.per_customer_limit, d.lifetime_limit_per_customer
    FROM public.deal_variants dv
    JOIN public.deals d ON d.id = dv.deal_id
    WHERE dv.id = ${args.variantId} LIMIT 1
  `;
  const v = rows[0];
  if (!v) throw new Error('Deal option not found.');
  if (v.deal_status !== 'active') throw new Error('This deal is no longer available.');
  if (v.spots_total !== null && v.spots_claimed + qty > v.spots_total) {
    const left = v.spots_total - v.spots_claimed;
    throw new Error(left <= 0 ? 'This deal is sold out.' : `Only ${left} left.`);
  }
  if (qty > v.per_customer_limit) {
    throw new Error(`Limit ${v.per_customer_limit} per customer.`);
  }

  // Lifetime cap: count vouchers this customer has ever bought for this DEAL
  // (across all its variants). Buying `qty` more must not exceed the cap.
  if (v.lifetime_limit_per_customer !== null) {
    const priorRows = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM public.claims
      WHERE user_id = ${args.userId} AND deal_id = ${v.deal_id}
        AND status IN ('active', 'redeemed')
    `;
    const prior = priorRows[0]?.count ?? 0;
    if (prior + qty > v.lifetime_limit_per_customer) {
      const remaining = v.lifetime_limit_per_customer - prior;
      throw new Error(
        remaining <= 0
          ? 'You\'ve already used this offer.'
          : `You can only buy ${remaining} more of this offer.`,
      );
    }
  }

  const totalCents = v.deal_price_cents * qty;
  const fee = await computeFee(sql, totalCents);

  const pi = await createPaymentIntent({
    amountCents: fee.consumerPaidCents,
    metadata: {
      userId: args.userId,
      variantId: v.variant_id,
      dealId: v.deal_id,
      vendorId: v.vendor_id,
      quantity: String(qty),
    },
  });

  const txnRows = await sql<{ id: string }[]>`
    INSERT INTO public.transactions (
      vendor_id, user_id, consumer_paid_cents, platform_fee_cents,
      vendor_payout_cents, platform_fee_id, platform_fee_snapshot,
      stripe_payment_intent_id, status
    ) VALUES (
      ${v.vendor_id}, ${args.userId}, ${fee.consumerPaidCents}, ${fee.platformFeeCents},
      ${fee.vendorPayoutCents}, ${fee.platformFeeId}, ${sql.json(fee.snapshot)},
      ${pi.paymentIntentId}, 'pending_payment'
    )
    RETURNING id
  `;

  return {
    clientSecret: pi.clientSecret,
    paymentIntentId: pi.paymentIntentId,
    transactionId: txnRows[0]!.id,
    amountCents: fee.consumerPaidCents,
  };
}

export interface PaymentMeta {
  userId: string;
  variantId: string;
  dealId: string;
  vendorId: string;
  quantity: number;
}

/**
 * Called from payment_intent.succeeded. Marks the transaction paid, creates one
 * active claim (voucher + QR) PER quantity, and bumps spots_claimed. Atomic +
 * idempotent (re-running for the same PI is a no-op once already paid).
 */
export async function fulfillPurchase(
  sql: Sql,
  paymentIntentId: string,
  meta: PaymentMeta,
): Promise<void> {
  await sql.begin(async (tx) => {
    const txns = await tx<{ id: string; status: string }[]>`
      SELECT id, status FROM public.transactions
      WHERE stripe_payment_intent_id = ${paymentIntentId} LIMIT 1
    `;
    const txn = txns[0];
    if (!txn || txn.status !== 'pending_payment') return; // unknown or already done

    const dealRows = await tx<{ title: string; code_validity_days: number }[]>`
      SELECT title, code_validity_days FROM public.deals WHERE id = ${meta.dealId} LIMIT 1
    `;
    const variantRows = await tx<{ label: string; deal_price_cents: number }[]>`
      SELECT label, deal_price_cents FROM public.deal_variants WHERE id = ${meta.variantId} LIMIT 1
    `;
    const deal = dealRows[0];
    const variant = variantRows[0];
    if (!deal || !variant) return;

    const validityDays = deal.code_validity_days || 60;
    const snapshot = {
      dealTitle: deal.title,
      variantLabel: variant.label,
      priceCents: variant.deal_price_cents,
    };

    // One voucher per quantity, each linked back to this transaction.
    for (let i = 0; i < meta.quantity; i++) {
      await tx`
        INSERT INTO public.claims (
          deal_id, vendor_id, variant_id, user_id, status,
          human_code, qr_payload, snapshot, expires_at, transaction_id
        ) VALUES (
          ${meta.dealId}, ${meta.vendorId}, ${meta.variantId}, ${meta.userId}, 'active',
          ${humanCode()}, ${'qr_' + randomUUID()}, ${tx.json(snapshot)},
          now() + (${validityDays} || ' days')::interval, ${txn.id}
        )
      `;
    }

    await tx`
      UPDATE public.deal_variants
      SET spots_claimed = spots_claimed + ${meta.quantity}
      WHERE id = ${meta.variantId}
    `;
    await tx`
      UPDATE public.transactions SET status = 'paid', paid_at = now(), updated_at = now()
      WHERE id = ${txn.id}
    `;
  });
}

/** Short human-readable redemption code, e.g. GLOE-7K2QX. */
function humanCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = randomBytes(5);
  for (let i = 0; i < 5; i++) s += chars[bytes[i]! % chars.length];
  return `GLOE-${s}`;
}
