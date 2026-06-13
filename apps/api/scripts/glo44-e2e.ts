/**
 * GLO-44 end-to-end money test — runs the REAL domain code against the dev DB
 * and Stripe test mode. No mocks: real promo rows, real PaymentIntents
 * (confirmed with pm_card_visa), real webhook-style fulfillment, real refunds.
 *
 * Run: npx tsx scripts/glo44-e2e.ts
 */
import 'dotenv/config';
import StripeNode from 'stripe';

import { sql } from '../src/db/client';
import { createPurchase, fulfillPurchase } from '../src/domain/checkout';
import { computeFee } from '../src/domain/fees';
import {
  createDealPromo, endDealPromo, getActivePromo, listDealPromos,
  previewVendorBoost, pricePromoOrder,
} from '../src/domain/promos';
import { refundTransaction } from '../src/domain/vendorOps';

const stripe = new StripeNode(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as never });

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${detail}`); }
}
async function expectThrow(name: string, fn: () => Promise<unknown>, msgPart: string) {
  try { await fn(); check(name, false, '(no error thrown)'); }
  catch (e) {
    const m = (e as Error).message;
    check(name, m.toLowerCase().includes(msgPart.toLowerCase()), `(got: ${m})`);
  }
}

async function main() {
  // ── Setup: a live deal w/ variant, its vendor, and a throwaway test user ──
  const dealRows = await sql<{ deal_id: string; vendor_id: string; variant_id: string; deal_price_cents: number; original_price_cents: number; title: string }[]>`
    SELECT d.id AS deal_id, d.vendor_id, dv.id AS variant_id,
           dv.deal_price_cents, dv.original_price_cents, d.title
    FROM public.deals d
    JOIN public.deal_variants dv ON dv.deal_id = d.id AND dv.active = true
    JOIN public.vendors v ON v.id = d.vendor_id AND v.status = 'active'
    WHERE d.status = 'active' AND d.expires_at > now()
      AND dv.deal_price_cents BETWEEN 10000 AND 50000
      AND NOT EXISTS (SELECT 1 FROM public.deal_promos p WHERE p.deal_id = d.id AND p.active)
    ORDER BY d.created_at DESC LIMIT 1
  `;
  const D = dealRows[0];
  if (!D) throw new Error('No suitable live deal found');
  console.log(`\nDeal under test: "${D.title}" — price $${D.deal_price_cents / 100} (orig $${D.original_price_cents / 100})\n`);

  const userRows = await sql<{ id: string }[]>`
    INSERT INTO public.users (clerk_user_id, email, first_name, last_name)
    VALUES ('e2e_glo44_' || gen_random_uuid(), 'glo44-e2e@test.gloe.app', 'Promo', 'Tester')
    RETURNING id
  `;
  const userId = userRows[0]!.id;
  const endsAt = new Date(Date.now() + 86400_000).toISOString();
  const cleanup: Array<() => Promise<void>> = [];

  try {
    // ════ 1. PLATFORM-FUNDED PROMO ════
    console.log('1) Platform-funded promo ($15 off)');
    const PROMO = 1500;
    const promo1 = await createDealPromo(sql, {
      dealId: D.deal_id, amountCents: PROMO, fundedBy: 'platform',
      endsAt, actorUserId: userId, actorRole: 'admin',
    });
    cleanup.push(() => endDealPromo(sql, promo1.id, { userId, role: 'admin' }).catch(() => {}));

    const live = await getActivePromo(sql, D.deal_id);
    check('promo is live + visible', live?.id === promo1.id);

    const priced = await pricePromoOrder(sql, { dealId: D.deal_id, vendorId: D.vendor_id, baseTotalCents: D.deal_price_cents });
    const feeFull = await computeFee(sql, D.deal_price_cents, D.vendor_id);
    check('fee computed on ORIGINAL price', priced.fee.platformFeeCents === feeFull.platformFeeCents);
    check('vendor payout unchanged (made whole)', priced.fee.vendorPayoutCents === feeFull.vendorPayoutCents);
    check('charge base = price − promo', priced.chargeBaseCents === D.deal_price_cents - PROMO);

    const buy1 = await createPurchase(sql, { userId, variantId: D.variant_id, quantity: 1, applyCredits: false });
    check('Stripe charge = price − promo', buy1.amountCents === D.deal_price_cents - PROMO);
    check('result exposes promoDiscountCents', buy1.promoDiscountCents === PROMO);

    const txn1 = (await sql<Record<string, number | string | null>[]>`
      SELECT consumer_paid_cents, platform_fee_cents, vendor_payout_cents,
             promo_discount_cents, promo_funded_by, deal_promo_id, credits_applied_cents
      FROM public.transactions WHERE id = ${buy1.transactionId}
    `)[0]!;
    check('txn.consumer_paid stays FULL price', txn1.consumer_paid_cents === D.deal_price_cents);
    check('txn.promo snapshot correct', txn1.promo_discount_cents === PROMO && txn1.promo_funded_by === 'platform' && txn1.deal_promo_id === promo1.id);
    check('txn.vendor_payout on full price', txn1.vendor_payout_cents === feeFull.vendorPayoutCents);

    const pi1 = await stripe.paymentIntents.retrieve(buy1.paymentIntentId!);
    check('PaymentIntent amount matches', pi1.amount === D.deal_price_cents - PROMO);

    // Pay it for real (test card) + fulfill the way the webhook does.
    await stripe.paymentIntents.confirm(pi1.id, { payment_method: 'pm_card_visa', return_url: 'https://gloe.app' });
    await fulfillPurchase(sql, pi1.id, {
      userId, variantId: D.variant_id, dealId: D.deal_id, vendorId: D.vendor_id, quantity: 1,
    });
    const claim1 = (await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM public.claims WHERE transaction_id = ${buy1.transactionId}
    `)[0];
    check('voucher minted on fulfillment', claim1?.status === 'active');

    // Refunds: ceiling must be price − promo, and over-refund must be refused.
    const over = await refundTransaction(sql, buy1.transactionId, D.deal_price_cents, userId, 'e2e over-refund probe');
    check('over-refund (full price) REFUSED', !over.refunded && /exceeds/.test(over.error ?? ''));
    const refund1 = await refundTransaction(sql, buy1.transactionId, D.deal_price_cents - PROMO, userId, 'e2e full refund');
    check('full refund of what customer PAID succeeds', refund1.refunded && refund1.isFullRefund);
    const refundObj = refund1.stripeRefundId ? await stripe.refunds.retrieve(refund1.stripeRefundId) : null;
    check('Stripe refund = cash actually charged', refundObj?.amount === D.deal_price_cents - PROMO);

    await endDealPromo(sql, promo1.id, { userId, role: 'admin' });
    check('promo ended (slot freed)', (await getActivePromo(sql, D.deal_id)) === null);

    // ════ 2. VENDOR-FUNDED BOOST ════
    console.log('\n2) Vendor-funded boost ($10 off)');
    const BOOST = 1000;
    const preview = await previewVendorBoost(sql, { dealId: D.deal_id, vendorId: D.vendor_id, amountCents: BOOST });
    const feeDisc = await computeFee(sql, D.deal_price_cents - BOOST, D.vendor_id);
    check('boost preview shows discounted payout', preview[0]?.payoutWithBoostCents === feeDisc.vendorPayoutCents);

    const promo2 = await createDealPromo(sql, {
      dealId: D.deal_id, amountCents: BOOST, fundedBy: 'vendor',
      label: 'Summer glow special', endsAt, actorUserId: userId, actorRole: 'vendor',
    });
    cleanup.push(() => endDealPromo(sql, promo2.id, { userId, role: 'admin' }).catch(() => {}));

    const buy2 = await createPurchase(sql, { userId, variantId: D.variant_id, quantity: 1, applyCredits: false });
    const txn2 = (await sql<Record<string, number | string | null>[]>`
      SELECT consumer_paid_cents, platform_fee_cents, vendor_payout_cents, promo_discount_cents, promo_funded_by
      FROM public.transactions WHERE id = ${buy2.transactionId}
    `)[0]!;
    check('sale booked AT discounted price', txn2.consumer_paid_cents === D.deal_price_cents - BOOST);
    check('fee computed on DISCOUNTED price', txn2.platform_fee_cents === feeDisc.platformFeeCents);
    check('vendor payout = discounted − fee(discounted)', txn2.vendor_payout_cents === feeDisc.vendorPayoutCents);
    check('charge = discounted price', buy2.amountCents === D.deal_price_cents - BOOST);

    await stripe.paymentIntents.confirm(buy2.paymentIntentId!, { payment_method: 'pm_card_visa', return_url: 'https://gloe.app' });
    await fulfillPurchase(sql, buy2.paymentIntentId!, {
      userId, variantId: D.variant_id, dealId: D.deal_id, vendorId: D.vendor_id, quantity: 1,
    });
    const refund2 = await refundTransaction(sql, buy2.transactionId, D.deal_price_cents - BOOST, userId, 'e2e cleanup refund');
    check('vendor-funded order refunds cleanly at paid amount', refund2.refunded && refund2.isFullRefund);

    // ════ 3. GUARDS ════
    console.log('\n3) Guards');
    await expectThrow('second live promo on same deal rejected',
      () => createDealPromo(sql, { dealId: D.deal_id, amountCents: 500, fundedBy: 'vendor', endsAt, actorUserId: userId, actorRole: 'vendor' }),
      'already has a live promo');
    await endDealPromo(sql, promo2.id, { userId, role: 'admin' });
    await expectThrow('promo bigger than price − 50¢ rejected',
      () => createDealPromo(sql, { dealId: D.deal_id, amountCents: D.deal_price_cents, fundedBy: 'platform', endsAt, actorUserId: userId, actorRole: 'admin' }),
      'too large');
    await expectThrow('admin cannot create vendor-funded',
      () => createDealPromo(sql, { dealId: D.deal_id, amountCents: 500, fundedBy: 'vendor', endsAt, actorUserId: userId, actorRole: 'admin' }),
      'platform-funded');
    await expectThrow('past end date rejected',
      () => createDealPromo(sql, { dealId: D.deal_id, amountCents: 500, fundedBy: 'platform', endsAt: new Date(Date.now() - 1000).toISOString(), actorUserId: userId, actorRole: 'admin' }),
      'future');

    // ════ 4. Cost-to-date listing ════
    console.log('\n4) God-mode listing');
    const list = await listDealPromos(sql, { dealId: D.deal_id, includeEnded: true });
    const l1 = list.find((p) => p.id === promo1.id);
    const l2 = list.find((p) => p.id === promo2.id);
    check('platform promo cost-to-date = $15 × 1 order', l1?.orderCount === 1 && l1?.costToDateCents === PROMO);
    check('boost cost-to-date = $10 × 1 order', l2?.orderCount === 1 && l2?.costToDateCents === BOOST);
    check('neither is live anymore', !l1?.isLive && !l2?.isLive);
  } finally {
    for (const fn of cleanup) await fn();
    // Test user keeps FK'd txns (financial records) — anonymize-style tidy only.
    await sql`UPDATE public.users SET email = NULL WHERE id = ${userId}`.catch(() => {});
    await sql.end();
  }

  console.log(`\n${'─'.repeat(40)}\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
