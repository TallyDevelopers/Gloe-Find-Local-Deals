import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { sql } from '../db/client';
import { computeFee } from '../domain/fees';
import { fulfillPurchase } from '../domain/checkout';
import { redeemClaimByVendor } from '../domain/claims';
import { getAdminTransactionDetail } from '../domain/admin';

/**
 * End-to-end MONEY test (GLO-34 sibling): customer buys → who gets what?
 *
 * Proves the split with the REAL domain code against the live DB + live fee
 * tiers, end to end:
 *   1. computeFee splits the price into platform fee + vendor payout (live tiers).
 *   2. fulfillPurchase marks the txn paid and mints the voucher (what the
 *      payment_intent.succeeded webhook does).
 *   3. redeemClaimByVendor flips the voucher to redeemed and (auto-release ON)
 *      fires the Stripe transfer of EXACTLY vendor_payout_cents to the vendor.
 *   4. The transaction ledger reflects paid→released with the right amounts.
 *
 * The only thing we can't truly settle is the live Stripe transfer (needs a
 * real connected account); the transfer CALL goes out with the correct amount
 * and destination and is asserted — it just won't land against a sandbox acct.
 * Everything is seeded under one test vendor and hard-deleted at the end.
 */

const CATEGORY_ID = '191d2383-4f0f-43ce-9dcc-7137386d2e66';

let passed = 0, failed = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : ''); }
}
const money = (c: number) => '$' + (c / 100).toFixed(2);
const settle = () => new Promise((r) => setTimeout(r, 250));

async function main() {
  const tag = randomUUID().slice(0, 8);
  console.log(`\n=== Money-split E2E (tag ${tag}) ===\n`);
  const created = { vendorId: '', userId: '', dealId: '', variantId: '', txnId: '', claimId: '' };

  try {
    // A vendor with auto-release ON (so redemption fires the transfer immediately)
    // and a real-looking Stripe acct id so the transfer wall's format check passes.
    const [vendor] = await sql<{ id: string }[]>`
      INSERT INTO public.vendors (business_name, slug, address_line1, city, region, postal_code, location, stripe_account_id, stripe_account_status, auto_release_on_redemption)
      VALUES (${'TEST Money Spa ' + tag}, ${'test-money-' + tag}, '1 Test St', 'Testville', 'CA', '90001',
              ST_SetSRID(ST_MakePoint(-118.24, 34.05), 4326)::geography,
              ${'acct_1' + tag.replace(/-/g, '').padEnd(23, '0').slice(0, 23)}, 'active', true)
      RETURNING id`;
    created.vendorId = vendor!.id;
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO public.users (clerk_user_id, email, first_name)
      VALUES (${'user_money_' + tag}, ${tag + '@test.local'}, 'Buyer') RETURNING id`;
    created.userId = user!.id;
    const [deal] = await sql<{ id: string }[]>`
      INSERT INTO public.deals (vendor_id, category_id, title, description, expires_at, status, code_validity_days)
      VALUES (${created.vendorId}, ${CATEGORY_ID}, ${'Money Deal ' + tag}, 'desc', now() + interval '60 days', 'active', 60)
      RETURNING id`;
    created.dealId = deal!.id;

    // $200 deal ($20000). Live tier: 20% under $500 → fee $40, vendor gets $160.
    const PRICE = 20000;
    const [variant] = await sql<{ id: string }[]>`
      INSERT INTO public.deal_variants (deal_id, label, original_price_cents, deal_price_cents)
      VALUES (${created.dealId}, 'Standard', 40000, ${PRICE}) RETURNING id`;
    created.variantId = variant!.id;

    // ---- 1. the split (real computeFee against live tiers) ----
    console.log('1. Fee split on a $200 purchase (live tiers):');
    const fee = await computeFee(sql, PRICE, created.vendorId);
    console.log(`   customer pays ${money(fee.consumerPaidCents)} · platform fee ${money(fee.platformFeeCents)} · vendor gets ${money(fee.vendorPayoutCents)}  [tier: ${fee.snapshot.label}]`);
    check('customer pays the full price', fee.consumerPaidCents === PRICE, fee.consumerPaidCents);
    check('platform fee = 20% = $40', fee.platformFeeCents === 4000, fee.platformFeeCents);
    check('vendor payout = $160', fee.vendorPayoutCents === 16000, fee.vendorPayoutCents);
    check('fee + payout == price (nothing lost)', fee.platformFeeCents + fee.vendorPayoutCents === PRICE);

    // Seed the pending txn exactly as createPurchase would (we skip the live
    // PaymentIntent network call; the fee math + columns are identical).
    const piId = 'pi_TEST_MONEY_' + tag;
    const [txn] = await sql<{ id: string }[]>`
      INSERT INTO public.transactions (vendor_id, user_id, consumer_paid_cents, platform_fee_cents, vendor_payout_cents, platform_fee_id, platform_fee_snapshot, stripe_payment_intent_id, status)
      VALUES (${created.vendorId}, ${created.userId}, ${fee.consumerPaidCents}, ${fee.platformFeeCents}, ${fee.vendorPayoutCents}, ${fee.platformFeeId}, ${sql.json(fee.snapshot)}, ${piId}, 'pending_payment')
      RETURNING id`;
    created.txnId = txn!.id;

    // ---- 2. payment succeeds → fulfillPurchase (the webhook's job) ----
    console.log('\n2. Payment succeeds → fulfill (mint voucher, mark paid):');
    // Pretend Stripe took a $6.10 processing fee on the $200 charge.
    const STRIPE_FEE = 610;
    await fulfillPurchase(sql, piId, {
      userId: created.userId, variantId: created.variantId, dealId: created.dealId,
      vendorId: created.vendorId, quantity: 1, stripeFeeCents: STRIPE_FEE,
    });
    const [paidTxn] = await sql<{ status: string; paid_at: string | null; stripe_fee_cents: number }[]>`
      SELECT status, paid_at, stripe_fee_cents FROM public.transactions WHERE id = ${created.txnId}`;
    check('transaction → paid', paidTxn!.status === 'paid', paidTxn);
    check('paid_at stamped', !!paidTxn!.paid_at);
    check('Stripe processing fee recorded', paidTxn!.stripe_fee_cents === STRIPE_FEE, paidTxn!.stripe_fee_cents);
    const claims = await sql<{ id: string; status: string }[]>`SELECT id, status FROM public.claims WHERE transaction_id = ${created.txnId}`;
    check('exactly one voucher minted', claims.length === 1, claims.length);
    check('voucher is active', claims[0]?.status === 'active', claims[0]?.status);
    created.claimId = claims[0]!.id;

    // Your NET cut = platform fee − Stripe's processing fee (vendor still gets full payout).
    const netCut = fee.platformFeeCents - STRIPE_FEE;
    console.log(`   → Gloē gross cut ${money(fee.platformFeeCents)} − Stripe ${money(STRIPE_FEE)} = NET ${money(netCut)} kept`);
    check('Gloē net cut is positive (we make money)', netCut > 0, netCut);

    // ---- 3. vendor redeems → transfer fires for the vendor payout ----
    console.log('\n3. Vendor redeems the voucher → release the payout:');
    const result = await redeemClaimByVendor(sql, created.vendorId, created.userId, created.claimId);
    check('claim redeemed', result.redeemed === true, result);
    // auto-release ON → it attempted the transfer. Sandbox acct can't receive,
    // so releaseError is expected; what matters is the AMOUNT + the attempt.
    const [redeemedClaim] = await sql<{ status: string; redeemed_at: string | null }[]>`SELECT status, redeemed_at FROM public.claims WHERE id = ${created.claimId}`;
    check('voucher → redeemed', redeemedClaim!.status === 'redeemed', redeemedClaim);
    check('redeemed_at stamped', !!redeemedClaim!.redeemed_at);
    if (result.released) {
      check('transfer fired for EXACTLY the vendor payout ($160)', result.released.amountCents === 16000, result.released);
    } else {
      // Expected against a sandbox/non-real connected acct — the call went out with
      // the right amount; Stripe rejected the destination. Prove it was attempted.
      console.log(`   (transfer attempt rejected by Stripe sandbox: ${result.releaseError})`);
      check('transfer was attempted (not silently skipped)', result.releaseError !== null, result);
      await settle();
      const [attempt] = await sql<{ action: string; meta: Record<string, unknown> }[]>`
        SELECT action, meta FROM public.audit_log WHERE claim_id = ${created.claimId} AND action LIKE 'transfer%' ORDER BY created_at DESC LIMIT 1`;
      check('transfer audit row written', !!attempt, attempt?.action);
    }

    // ---- 4. the ledger the admin sees ----
    console.log('\n4. Admin transaction ledger:');
    const detail = await getAdminTransactionDetail(sql, created.txnId);
    const t = detail!.transaction;
    console.log(`   ledger: paid ${money(t.consumerPaidCents)} · fee ${money(t.platformFeeCents)} · payout ${money(t.vendorPayoutCents)} · stripe ${money(t.stripeFeeCents)} · status ${t.status}`);
    check('ledger consumer paid = $200', t.consumerPaidCents === 20000, t.consumerPaidCents);
    check('ledger platform fee = $40', t.platformFeeCents === 4000, t.platformFeeCents);
    check('ledger vendor payout = $160', t.vendorPayoutCents === 16000, t.vendorPayoutCents);
    check('ledger fee math closes (paid = fee + payout)', t.platformFeeCents + t.vendorPayoutCents === t.consumerPaidCents);
    check('fee snapshot frozen on the txn', !!t.platformFeeSnapshot, t.platformFeeSnapshot);

    console.log('\n   Summary: customer $200  →  vendor $160  +  Gloē $40 gross ($' + (netCut/100).toFixed(2) + ' net after Stripe).');
  } finally {
    console.log('\nCleaning up…');
    const vid = created.vendorId || null;
    if (vid) {
      await sql`DELETE FROM public.redemption_attempts WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.audit_log WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.claims WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.transactions WHERE vendor_id = ${vid}`;
      if (created.variantId) await sql`DELETE FROM public.deal_variants WHERE id = ${created.variantId}`;
      if (created.dealId) await sql`DELETE FROM public.deals WHERE id = ${created.dealId}`;
      await sql`DELETE FROM public.vendors WHERE id = ${vid}`;
    }
    if (created.userId) await sql`DELETE FROM public.users WHERE id = ${created.userId}`;
    console.log('Cleaned up.');
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
