import { randomBytes, randomUUID } from 'node:crypto';

import type { Sql } from '../db/client';
import { writeAudit } from './audit';
import { computeApplicableCredits, redeemCreditsForTransaction, type RedeemSummary } from './credits';
import { computeFee } from './fees';
import { getVoucherValidityDays } from './platformSettings';
import { createGiftCheckoutSession, createPaymentIntent } from './stripe';

export interface CreatePurchaseResult {
  /** Null on the zero-dollar path — credits covered everything, no Stripe step. */
  clientSecret: string | null;
  paymentIntentId: string | null;
  transactionId: string;
  /** Cash actually charged to Stripe = order total − credits applied. */
  amountCents: number;
  creditsAppliedCents: number;
  /** True when credits covered the whole order — vouchers are already minted;
   *  the client skips the payment sheet and goes straight to success. */
  paidWithCredits: boolean;
}

const MAX_QTY = 10;

/**
 * Per-link spend ceiling for "share to pay" purchases. Bounds blast radius if
 * a shared URL ends up in the wrong hands (someone re-shares on a fraud forum,
 * etc.). Tighter than per-customer caps because the cardholder ≠ the redeemer.
 */
const GIFT_LINK_MAX_AMOUNT_CENTS = 50_000; // $500

/**
 * Starts a purchase of `quantity` of one deal option (same vendor, one charge).
 * Computes the fee on the total, creates a held PaymentIntent, and records a
 * `pending_payment` transaction. Vouchers (claims) are created on payment
 * success — one per quantity — so an unpaid order never yields a live voucher.
 *
 * Credits (GLO-24): unless `applyCredits` is false, the user's wallet balance
 * is auto-applied (server-computed inside the txn — the client only sends the
 * toggle). `consumer_paid_cents` stays the FULL order value so the fee
 * snapshot and vendor payout never change; only the Stripe charge shrinks.
 * If credits cover everything, we skip Stripe entirely and fulfill inline.
 */
export async function createPurchase(
  sql: Sql,
  args: { userId: string; variantId: string; quantity: number; applyCredits?: boolean },
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
  const fee = await computeFee(sql, totalCents, v.vendor_id);

  // Reserve credits + record the transaction atomically. The FOR UPDATE inside
  // computeApplicableCredits plus this INSERT (the reservation a later checkout
  // subtracts) prevents the same balance funding two concurrent purchases.
  const { transactionId, creditsAppliedCents, cashCents } = await sql.begin(async (tx) => {
    const applied = args.applyCredits === false
      ? 0
      : await computeApplicableCredits(tx, { userId: args.userId, orderTotalCents: fee.consumerPaidCents });
    const txnRows = await tx<{ id: string }[]>`
      INSERT INTO public.transactions (
        vendor_id, user_id, consumer_paid_cents, platform_fee_cents,
        vendor_payout_cents, platform_fee_id, platform_fee_snapshot,
        credits_applied_cents, status
      ) VALUES (
        ${v.vendor_id}, ${args.userId}, ${fee.consumerPaidCents}, ${fee.platformFeeCents},
        ${fee.vendorPayoutCents}, ${fee.platformFeeId}, ${tx.json(fee.snapshot)},
        ${applied}, 'pending_payment'
      )
      RETURNING id
    `;
    return {
      transactionId: txnRows[0]!.id,
      creditsAppliedCents: applied,
      cashCents: fee.consumerPaidCents - applied,
    };
  });

  // Zero-dollar path: balance covers the whole order. No PaymentIntent, no
  // webhook — fulfill inline through the same core (claims + credit drawdown
  // + receipt), with the txn flipping straight to paid.
  if (cashCents === 0) {
    await fulfillPurchase(sql, null, {
      userId: args.userId,
      variantId: v.variant_id,
      dealId: v.deal_id,
      vendorId: v.vendor_id,
      quantity: qty,
      transactionId,
    });
    return {
      clientSecret: null,
      paymentIntentId: null,
      transactionId,
      amountCents: 0,
      creditsAppliedCents,
      paidWithCredits: true,
    };
  }

  let pi;
  try {
    pi = await createPaymentIntent({
      amountCents: cashCents,
      metadata: {
        userId: args.userId,
        variantId: v.variant_id,
        dealId: v.deal_id,
        vendorId: v.vendor_id,
        quantity: String(qty),
        creditsAppliedCents: String(creditsAppliedCents),
      },
    });
  } catch (e) {
    // Void the reservation so the credits aren't held hostage by a Stripe error.
    await sql`UPDATE public.transactions SET status = 'failed', updated_at = now() WHERE id = ${transactionId}`;
    throw e;
  }
  await sql`
    UPDATE public.transactions
    SET stripe_payment_intent_id = ${pi.paymentIntentId}, updated_at = now()
    WHERE id = ${transactionId}
  `;

  return {
    clientSecret: pi.clientSecret,
    paymentIntentId: pi.paymentIntentId,
    transactionId,
    amountCents: cashCents,
    creditsAppliedCents,
    paidWithCredits: false,
  };
}

export interface CreateGiftLinkResult {
  giftUrl: string;
  stripeCheckoutUrl: string;
  sessionId: string;
  transactionId: string;
  amountCents: number;
}

/**
 * "Share to pay" — the in-app customer (the *redeemer*) generates a Stripe
 * Checkout Session that someone else can pay. On success, the voucher credits
 * to the redeemer's account (driven by metadata.userId), not the payer.
 *
 * Mirrors createPurchase's invariants: deal active, spots available,
 * per-customer + lifetime caps still enforced (against the redeemer, who
 * gets the voucher). Then writes a `pending_payment` transaction tagged
 * `payment_source='gift_link'` so we can distinguish payment paths later.
 */
export async function createGiftLink(
  sql: Sql,
  args: {
    redeemerUserId: string;
    variantId: string;
    quantity: number;
    /** Public origin used to build the Gloē-hosted gift page + return URLs. */
    publicOrigin: string;
  },
): Promise<CreateGiftLinkResult> {
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
    deal_title: string;
    variant_label: string;
    vendor_name: string;
    deal_photo_url: string | null;
  }[]>`
    SELECT dv.id AS variant_id, d.id AS deal_id, d.vendor_id,
           dv.deal_price_cents, dv.spots_total, dv.spots_claimed,
           d.status AS deal_status, d.per_customer_limit, d.lifetime_limit_per_customer,
           d.title AS deal_title, dv.label AS variant_label,
           ven.business_name AS vendor_name,
           (SELECT dp.url FROM public.deal_photos dp
             WHERE dp.deal_id = d.id ORDER BY dp.display_order ASC LIMIT 1) AS deal_photo_url
    FROM public.deal_variants dv
    JOIN public.deals d ON d.id = dv.deal_id
    JOIN public.vendors ven ON ven.id = d.vendor_id
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
  if (v.lifetime_limit_per_customer !== null) {
    const priorRows = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM public.claims
      WHERE user_id = ${args.redeemerUserId} AND deal_id = ${v.deal_id}
        AND status IN ('active', 'redeemed')
    `;
    const prior = priorRows[0]?.count ?? 0;
    if (prior + qty > v.lifetime_limit_per_customer) {
      const remaining = v.lifetime_limit_per_customer - prior;
      throw new Error(
        remaining <= 0
          ? "You've already used this offer."
          : `You can only buy ${remaining} more of this offer.`,
      );
    }
  }

  const totalCents = v.deal_price_cents * qty;
  const fee = await computeFee(sql, totalCents, v.vendor_id);

  if (fee.consumerPaidCents > GIFT_LINK_MAX_AMOUNT_CENTS) {
    throw new Error(
      `Share-to-pay is capped at $${(GIFT_LINK_MAX_AMOUNT_CENTS / 100).toFixed(0)} per link. Pay in-app for higher amounts.`,
    );
  }

  const session = await createGiftCheckoutSession({
    amountCents: fee.consumerPaidCents,
    productName: v.deal_title,
    productDescription: `${v.vendor_name} · ${v.variant_label}${qty > 1 ? ` × ${qty}` : ''}`,
    productImageUrl: v.deal_photo_url,
    // Stripe redirects to our hosted post-checkout page so we own the moment.
    // {CHECKOUT_SESSION_ID} is a Stripe template token replaced at redirect.
    successUrl: `${args.publicOrigin}/gift/{CHECKOUT_SESSION_ID}?success=1`,
    cancelUrl: `${args.publicOrigin}/gift/{CHECKOUT_SESSION_ID}`,
    metadata: {
      // Mirrors PaymentIntent metadata so the existing webhook flow can
      // fulfill the same way, crediting to the *redeemer*.
      userId: args.redeemerUserId,
      variantId: v.variant_id,
      dealId: v.deal_id,
      vendorId: v.vendor_id,
      quantity: String(qty),
      paymentSource: 'gift_link',
    },
  });

  const txnRows = await sql<{ id: string }[]>`
    INSERT INTO public.transactions (
      vendor_id, user_id, consumer_paid_cents, platform_fee_cents,
      vendor_payout_cents, platform_fee_id, platform_fee_snapshot,
      stripe_checkout_session_id, payment_source, status
    ) VALUES (
      ${v.vendor_id}, ${args.redeemerUserId}, ${fee.consumerPaidCents}, ${fee.platformFeeCents},
      ${fee.vendorPayoutCents}, ${fee.platformFeeId}, ${sql.json(fee.snapshot)},
      ${session.sessionId}, 'gift_link', 'pending_payment'
    )
    RETURNING id
  `;

  return {
    giftUrl: `${args.publicOrigin}/gift/${session.sessionId}`,
    stripeCheckoutUrl: session.url!,
    sessionId: session.sessionId,
    transactionId: txnRows[0]!.id,
    amountCents: fee.consumerPaidCents,
  };
}

export interface CreateHostedCheckoutResult {
  /** Hosted-mode redirect URL (null in embedded mode and on the zero-dollar path). */
  checkoutUrl: string | null;
  /** Embedded-mode client secret for Stripe's <EmbeddedCheckout> (null in hosted
   *  mode and on the zero-dollar path — paidWithCredits is the success marker). */
  clientSecret: string | null;
  /** Null on the zero-dollar path (no Stripe session exists). */
  sessionId: string | null;
  transactionId: string;
  /** Cash for the Stripe session = order total − credits applied. */
  amountCents: number;
  creditsAppliedCents: number;
  /** True when credits covered the whole order — no Stripe step; the UI should
   *  treat this as direct success (vouchers are already minted). */
  paidWithCredits: boolean;
}

/**
 * Web self-purchase via Stripe-hosted Checkout. Unlike createPurchase (native
 * PaymentSheet) the web has no in-app sheet, so the signed-in buyer is sent to
 * a hosted Checkout Session and redirected back to /wallet on success. The
 * buyer is also the redeemer (voucher credits to them), so there's no
 * share-to-pay ceiling. Fulfillment reuses the existing
 * checkout.session.completed → fulfillPurchase path (keyed by session id).
 */
export async function createHostedCheckout(
  sql: Sql,
  args: {
    userId: string;
    variantId: string;
    quantity: number;
    publicOrigin: string;
    embedded?: boolean;
    applyCredits?: boolean;
  },
): Promise<CreateHostedCheckoutResult> {
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
    deal_title: string;
    variant_label: string;
    vendor_name: string;
    deal_photo_url: string | null;
  }[]>`
    SELECT dv.id AS variant_id, d.id AS deal_id, d.vendor_id,
           dv.deal_price_cents, dv.spots_total, dv.spots_claimed,
           d.status AS deal_status, d.per_customer_limit, d.lifetime_limit_per_customer,
           d.title AS deal_title, dv.label AS variant_label,
           ven.business_name AS vendor_name,
           (SELECT dp.url FROM public.deal_photos dp
             WHERE dp.deal_id = d.id ORDER BY dp.display_order ASC LIMIT 1) AS deal_photo_url
    FROM public.deal_variants dv
    JOIN public.deals d ON d.id = dv.deal_id
    JOIN public.vendors ven ON ven.id = d.vendor_id
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
          ? "You've already used this offer."
          : `You can only buy ${remaining} more of this offer.`,
      );
    }
  }

  const totalCents = v.deal_price_cents * qty;
  const fee = await computeFee(sql, totalCents, v.vendor_id);

  // Same credits reservation pattern as createPurchase — see comments there.
  const { transactionId, creditsAppliedCents, cashCents } = await sql.begin(async (tx) => {
    const applied = args.applyCredits === false
      ? 0
      : await computeApplicableCredits(tx, { userId: args.userId, orderTotalCents: fee.consumerPaidCents });
    const txnRows = await tx<{ id: string }[]>`
      INSERT INTO public.transactions (
        vendor_id, user_id, consumer_paid_cents, platform_fee_cents,
        vendor_payout_cents, platform_fee_id, platform_fee_snapshot,
        credits_applied_cents, payment_source, status
      ) VALUES (
        ${v.vendor_id}, ${args.userId}, ${fee.consumerPaidCents}, ${fee.platformFeeCents},
        ${fee.vendorPayoutCents}, ${fee.platformFeeId}, ${tx.json(fee.snapshot)},
        ${applied}, 'web', 'pending_payment'
      )
      RETURNING id
    `;
    return {
      transactionId: txnRows[0]!.id,
      creditsAppliedCents: applied,
      cashCents: fee.consumerPaidCents - applied,
    };
  });

  // Zero-dollar path: no Stripe session at all — fulfill inline and hand the
  // UI a direct-success marker instead of a clientSecret.
  if (cashCents === 0) {
    await fulfillPurchase(sql, null, {
      userId: args.userId,
      variantId: v.variant_id,
      dealId: v.deal_id,
      vendorId: v.vendor_id,
      quantity: qty,
      transactionId,
    });
    return {
      checkoutUrl: null,
      clientSecret: null,
      sessionId: null,
      transactionId,
      amountCents: 0,
      creditsAppliedCents,
      paidWithCredits: true,
    };
  }

  let session;
  try {
    session = await createGiftCheckoutSession({
      amountCents: cashCents,
      productName: v.deal_title,
      productDescription: `${v.vendor_name} · ${v.variant_label}${qty > 1 ? ` × ${qty}` : ''}`,
      productImageUrl: v.deal_photo_url,
      // Embedded: Stripe renders the form on gloe.app and returns the payer to
      // /wallet after success. Hosted (legacy): redirect + back-out URLs.
      ...(args.embedded
        ? { uiMode: 'embedded' as const, returnUrl: `${args.publicOrigin}/wallet?purchased=1&session_id={CHECKOUT_SESSION_ID}` }
        : { successUrl: `${args.publicOrigin}/wallet?purchased=1`, cancelUrl: `${args.publicOrigin}/deals/${v.deal_id}` }),
      metadata: {
        userId: args.userId,
        variantId: v.variant_id,
        dealId: v.deal_id,
        vendorId: v.vendor_id,
        quantity: String(qty),
        paymentSource: 'web',
        creditsAppliedCents: String(creditsAppliedCents),
      },
    });
  } catch (e) {
    await sql`UPDATE public.transactions SET status = 'failed', updated_at = now() WHERE id = ${transactionId}`;
    throw e;
  }
  await sql`
    UPDATE public.transactions
    SET stripe_checkout_session_id = ${session.sessionId}, updated_at = now()
    WHERE id = ${transactionId}
  `;

  return {
    checkoutUrl: session.url ?? null,
    clientSecret: session.clientSecret ?? null,
    sessionId: session.sessionId,
    transactionId,
    amountCents: cashCents,
    creditsAppliedCents,
    paidWithCredits: false,
  };
}

export interface PaymentMeta {
  userId: string;
  variantId: string;
  dealId: string;
  vendorId: string;
  quantity: number;
  /** Stripe's processing fee on the charge, in cents. Comes from the
   *  balance_transaction; the webhook handler pulls it before calling us. */
  stripeFeeCents?: number;
  /** For gift_link transactions: payer identity captured by Stripe Checkout. */
  payerEmail?: string | null;
  payerName?: string | null;
  /** If the webhook arrived from checkout.session.completed (not the PI event),
   *  the caller passes the session ID so we can find the txn that way. */
  stripeCheckoutSessionId?: string;
  /** Zero-dollar inline path: no Stripe ids exist, so the caller passes the
   *  transaction id directly. */
  transactionId?: string;
  /** charge.payment_method_details.card.fingerprint from the webhook's expanded
   *  PaymentIntent — persisted for the referral self-funding guard. Best-effort. */
  cardFingerprint?: string | null;
}

/**
 * THE fulfillment core — called from payment_intent.succeeded,
 * checkout.session.completed, AND inline for zero-dollar (all-credits) orders.
 * Marks the transaction paid, creates one active claim (voucher + QR) PER
 * quantity, bumps spots_claimed, and consumes any reserved credits in the
 * SAME transaction (lots drawn down exactly once — idempotent on the txn).
 * Atomic + idempotent — re-running for the same txn is a no-op once already
 * paid, so Stripe firing both events for a gift link won't double-fulfill.
 *
 * Lookup: for in-app the caller passes a PaymentIntent ID. For gift links the
 * webhook fires checkout.session.completed first; the caller passes the
 * Checkout Session ID via meta.stripeCheckoutSessionId and we resolve the txn
 * that way (we also backfill the PI id from the session at that point). The
 * zero-dollar path passes meta.transactionId (there are no Stripe ids).
 */
export async function fulfillPurchase(
  sql: Sql,
  paymentIntentId: string | null,
  meta: PaymentMeta,
): Promise<void> {
  // Captured inside the txn, used to fire the receipt AFTER it commits (a
  // failed email must never roll back a paid purchase).
  const receiptCodes: string[] = [];
  let receiptExpiresAt = '';
  type ReceiptCore = { dealTitle: string; vendorName: string; variantLabel: string; amountPaidCents: number; photoUrl: string | null };
  let receipt: ReceiptCore | null = null;
  let fulfilledTxnId: string | null = null;
  let creditsAppliedCents = 0;
  let redeemed: RedeemSummary | null = null;

  await sql.begin(async (tx) => {
    type TxnRow = {
      id: string;
      status: string;
      user_id: string;
      consumer_paid_cents: number;
      credits_applied_cents: number;
    };
    const txns = meta.transactionId
      ? await tx<TxnRow[]>`
          SELECT id, status, user_id, consumer_paid_cents, credits_applied_cents
          FROM public.transactions
          WHERE id = ${meta.transactionId} LIMIT 1
        `
      : meta.stripeCheckoutSessionId
        ? await tx<TxnRow[]>`
            SELECT id, status, user_id, consumer_paid_cents, credits_applied_cents
            FROM public.transactions
            WHERE stripe_checkout_session_id = ${meta.stripeCheckoutSessionId} LIMIT 1
          `
        : await tx<TxnRow[]>`
            SELECT id, status, user_id, consumer_paid_cents, credits_applied_cents
            FROM public.transactions
            WHERE stripe_payment_intent_id = ${paymentIntentId} LIMIT 1
          `;
    const txn = txns[0];
    if (!txn || txn.status !== 'pending_payment') return; // unknown or already done

    const dealRows = await tx<{ title: string; code_validity_days: number | null; photo_url: string | null }[]>`
      SELECT title, code_validity_days,
             (SELECT dp.url FROM public.deal_photos dp
                WHERE dp.deal_id = d.id
                ORDER BY CASE WHEN dp.photo_type = 'hero' THEN 0 ELSE 1 END, dp.display_order ASC
                LIMIT 1) AS photo_url
      FROM public.deals d WHERE d.id = ${meta.dealId} LIMIT 1
    `;
    const variantRows = await tx<{ label: string; deal_price_cents: number; original_price_cents: number }[]>`
      SELECT label, deal_price_cents, original_price_cents
      FROM public.deal_variants WHERE id = ${meta.variantId} LIMIT 1
    `;
    const vendorRows = await tx<{ business_name: string }[]>`
      SELECT business_name FROM public.vendors WHERE id = ${meta.vendorId} LIMIT 1
    `;
    const deal = dealRows[0];
    const variant = variantRows[0];
    const vendor = vendorRows[0];
    if (!deal || !variant || !vendor) return;

    // Per-deal override wins; otherwise the admin-set platform window (GLO-29).
    const validityDays = deal.code_validity_days ?? (await getVoucherValidityDays(tx));
    // Snapshot shape must match @gloe/mobile features/claimed/types.ts. Adding
    // fields here without updating the mobile type will silently render NaN/undefined.
    const snapshot = {
      dealTitle: deal.title,
      vendorName: vendor.business_name,
      vendorId: meta.vendorId,
      variantLabel: variant.label,
      originalPriceCents: variant.original_price_cents,
      dealPriceCents: variant.deal_price_cents,
    };
    receipt = {
      dealTitle: deal.title,
      vendorName: vendor.business_name,
      variantLabel: variant.label,
      amountPaidCents: variant.deal_price_cents * meta.quantity,
      photoUrl: deal.photo_url,
    };

    // One voucher per quantity, each linked back to this transaction.
    for (let i = 0; i < meta.quantity; i++) {
      const codeRows = await tx<{ human_code: string; expires_at: string }[]>`
        INSERT INTO public.claims (
          deal_id, vendor_id, variant_id, user_id, status,
          human_code, qr_payload, snapshot, expires_at, transaction_id
        ) VALUES (
          ${meta.dealId}, ${meta.vendorId}, ${meta.variantId}, ${meta.userId}, 'active',
          ${humanCode()}, ${'qr_' + randomUUID()}, ${tx.json(snapshot)},
          now() + (${validityDays} || ' days')::interval, ${txn.id}
        )
        RETURNING human_code, expires_at
      `;
      const r = codeRows[0]!;
      receiptCodes.push(r.human_code);
      receiptExpiresAt = r.expires_at;
    }

    await tx`
      UPDATE public.deal_variants
      SET spots_claimed = spots_claimed + ${meta.quantity}
      WHERE id = ${meta.variantId}
    `;
    await tx`
      UPDATE public.transactions
      SET status                    = 'paid',
          paid_at                   = now(),
          updated_at                = now(),
          stripe_fee_cents          = ${meta.stripeFeeCents ?? 0},
          stripe_payment_intent_id  = COALESCE(stripe_payment_intent_id, ${paymentIntentId ?? null}),
          card_fingerprint          = COALESCE(card_fingerprint, ${meta.cardFingerprint ?? null}),
          payer_email               = COALESCE(payer_email, ${meta.payerEmail ?? null}),
          payer_name                = COALESCE(payer_name, ${meta.payerName ?? null})
      WHERE id = ${txn.id}
    `;

    // Consume the credits reserved at checkout — SAME transaction as the
    // vouchers so lots draw down exactly once (idempotent on the txn).
    if (txn.credits_applied_cents > 0) {
      redeemed = await redeemCreditsForTransaction(tx, {
        userId: txn.user_id,
        transactionId: txn.id,
        amountCents: txn.credits_applied_cents,
        orderTotalCents: txn.consumer_paid_cents,
      });
    }
    fulfilledTxnId = txn.id;
    creditsAppliedCents = txn.credits_applied_cents;
  });

  // Receipt — fire-and-forget, post-commit. `receipt` is only set when we
  // actually fulfilled (it stays null if the txn was already done / not found),
  // so this no-ops on a duplicate webhook. Never throws into the caller.
  const r = receipt as ReceiptCore | null;
  if (r && receiptCodes.length > 0) {
    void sendReceiptEmail(sql, {
      userId: meta.userId,
      payerEmail: meta.payerEmail ?? null,
      quantity: meta.quantity,
      codes: receiptCodes,
      expiresAt: receiptExpiresAt,
      dealTitle: r.dealTitle,
      vendorName: r.vendorName,
      variantLabel: r.variantLabel,
      amountPaidCents: r.amountPaidCents,
      creditsAppliedCents,
      photoUrl: r.photoUrl,
    }).catch((e) => console.error('[receipt] failed:', (e as Error).message));
  }

  // Post-commit, only on an actual fulfillment (fulfilledTxnId stays null on
  // duplicate webhooks). Audit the credit drawdown, then check whether this
  // was a referee's first qualifying purchase — fire-and-forget, every
  // outcome audited inside maybePayoutReferrerOnFirstPurchase.
  const consumed = redeemed as RedeemSummary | null;
  const txId = fulfilledTxnId as string | null;
  if (txId && consumed && consumed.redeemedCents > 0) {
    void writeAudit(sql, {
      action: 'credit.redeemed',
      transactionId: txId,
      meta: {
        userId: meta.userId,
        amountCents: consumed.redeemedCents,
        shortfallCents: consumed.shortfallCents,
        lots: consumed.lots,
      },
    });
  }
  if (txId) {
    void import('./referrals')
      .then((m) => m.maybePayoutReferrerOnFirstPurchase(sql, txId))
      .catch((e) => console.error('[referral] payout check failed:', (e as Error).message));
  }
}

/**
 * Sends the purchase receipt. Recipient = the in-app user's email; for gift
 * links where there may be no user email, falls back to the payer's email.
 * Best-effort: resolves quietly if there's no address or email isn't configured.
 */
async function sendReceiptEmail(
  sql: Sql,
  d: {
    userId: string; payerEmail: string | null; quantity: number;
    codes: string[]; expiresAt: string;
    dealTitle: string; vendorName: string; variantLabel: string; amountPaidCents: number;
    creditsAppliedCents: number; photoUrl: string | null;
  },
): Promise<void> {
  const userRows = await sql<{ email: string | null; first_name: string | null }[]>`
    SELECT email, first_name FROM public.users WHERE id = ${d.userId} LIMIT 1
  `;
  const to = userRows[0]?.email ?? d.payerEmail;
  if (!to) return;

  const { createElement } = await import('react');
  const { render } = await import('@react-email/components');
  const { ReceiptEmail } = await import('../emails/ReceiptEmail');
  const { sendEmail } = await import('./email');

  // Only include the banner if the photo URL actually resolves — a broken <img>
  // makes the whole receipt look cheap. Cheap HEAD check, short timeout, best-effort.
  const photoUrl = await resolvablePhoto(d.photoUrl);

  const expiresAt = new Date(d.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const html = await render(
    createElement(ReceiptEmail, {
      firstName: userRows[0]?.first_name ?? null,
      dealTitle: d.dealTitle, vendorName: d.vendorName, variantLabel: d.variantLabel,
      quantity: d.quantity, amountPaidCents: d.amountPaidCents, codes: d.codes, expiresAt,
      creditsAppliedCents: d.creditsAppliedCents,
      photoUrl,
      walletUrl: `${process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app'}/wallet`,
    }),
  );
  await sendEmail({
    to,
    subject: `Your ${d.dealTitle} receipt`,
    html,
    idempotencyKey: `receipt:${d.codes.join(',')}`,
  });
}

/** Returns the URL only if it 200s within 2s, else null — so we never embed a
 *  broken <img> in a receipt. Best-effort; any failure → null (omit the banner). */
async function resolvablePhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

/** Short human-readable redemption code, e.g. GLOE-7K2QX. */
function humanCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const bytes = randomBytes(5);
  for (let i = 0; i < 5; i++) s += chars[bytes[i]! % chars.length];
  return `GLOE-${s}`;
}
