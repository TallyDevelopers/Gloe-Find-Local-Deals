import { randomBytes, randomUUID } from 'node:crypto';

import type { Sql } from '../db/client';
import { computeFee } from './fees';
import { createGiftCheckoutSession, createPaymentIntent } from './stripe';

export interface CreatePurchaseResult {
  clientSecret: string;
  paymentIntentId: string;
  transactionId: string;
  amountCents: number;
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
  const fee = await computeFee(sql, totalCents, v.vendor_id);

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
  /** Hosted-mode redirect URL (null in embedded mode). */
  checkoutUrl: string | null;
  /** Embedded-mode client secret for Stripe's <EmbeddedCheckout> (null in hosted mode). */
  clientSecret: string | null;
  sessionId: string;
  transactionId: string;
  amountCents: number;
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
  args: { userId: string; variantId: string; quantity: number; publicOrigin: string; embedded?: boolean },
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

  const session = await createGiftCheckoutSession({
    amountCents: fee.consumerPaidCents,
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
    },
  });

  const txnRows = await sql<{ id: string }[]>`
    INSERT INTO public.transactions (
      vendor_id, user_id, consumer_paid_cents, platform_fee_cents,
      vendor_payout_cents, platform_fee_id, platform_fee_snapshot,
      stripe_checkout_session_id, payment_source, status
    ) VALUES (
      ${v.vendor_id}, ${args.userId}, ${fee.consumerPaidCents}, ${fee.platformFeeCents},
      ${fee.vendorPayoutCents}, ${fee.platformFeeId}, ${sql.json(fee.snapshot)},
      ${session.sessionId}, 'web', 'pending_payment'
    )
    RETURNING id
  `;

  return {
    checkoutUrl: session.url ?? null,
    clientSecret: session.clientSecret ?? null,
    sessionId: session.sessionId,
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
  /** Stripe's processing fee on the charge, in cents. Comes from the
   *  balance_transaction; the webhook handler pulls it before calling us. */
  stripeFeeCents?: number;
  /** For gift_link transactions: payer identity captured by Stripe Checkout. */
  payerEmail?: string | null;
  payerName?: string | null;
  /** If the webhook arrived from checkout.session.completed (not the PI event),
   *  the caller passes the session ID so we can find the txn that way. */
  stripeCheckoutSessionId?: string;
}

/**
 * Called from payment_intent.succeeded OR checkout.session.completed. Marks
 * the transaction paid, creates one active claim (voucher + QR) PER quantity,
 * and bumps spots_claimed. Atomic + idempotent — re-running for the same
 * txn is a no-op once already paid, so Stripe firing both events for a gift
 * link won't double-fulfill.
 *
 * Lookup: for in-app the caller passes a PaymentIntent ID. For gift links the
 * webhook fires checkout.session.completed first; the caller passes the
 * Checkout Session ID via meta.stripeCheckoutSessionId and we resolve the txn
 * that way (we also backfill the PI id from the session at that point).
 */
export async function fulfillPurchase(
  sql: Sql,
  paymentIntentId: string,
  meta: PaymentMeta,
): Promise<void> {
  // Captured inside the txn, used to fire the receipt AFTER it commits (a
  // failed email must never roll back a paid purchase).
  const receiptCodes: string[] = [];
  let receiptExpiresAt = '';
  type ReceiptCore = { dealTitle: string; vendorName: string; variantLabel: string; amountPaidCents: number; photoUrl: string | null };
  let receipt: ReceiptCore | null = null;

  await sql.begin(async (tx) => {
    const txns = meta.stripeCheckoutSessionId
      ? await tx<{ id: string; status: string }[]>`
          SELECT id, status FROM public.transactions
          WHERE stripe_checkout_session_id = ${meta.stripeCheckoutSessionId} LIMIT 1
        `
      : await tx<{ id: string; status: string }[]>`
          SELECT id, status FROM public.transactions
          WHERE stripe_payment_intent_id = ${paymentIntentId} LIMIT 1
        `;
    const txn = txns[0];
    if (!txn || txn.status !== 'pending_payment') return; // unknown or already done

    const dealRows = await tx<{ title: string; code_validity_days: number; photo_url: string | null }[]>`
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

    const validityDays = deal.code_validity_days || 60;
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
          stripe_payment_intent_id  = COALESCE(stripe_payment_intent_id, ${paymentIntentId}),
          payer_email               = COALESCE(payer_email, ${meta.payerEmail ?? null}),
          payer_name                = COALESCE(payer_name, ${meta.payerName ?? null})
      WHERE id = ${txn.id}
    `;
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
      photoUrl: r.photoUrl,
    }).catch((e) => console.error('[receipt] failed:', (e as Error).message));
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
    dealTitle: string; vendorName: string; variantLabel: string; amountPaidCents: number; photoUrl: string | null;
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
