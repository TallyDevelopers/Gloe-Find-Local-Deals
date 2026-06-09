import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { sql } from '../db/client';
import { computeFee, createTier, updateTier, deactivateTier, TierOverlapError } from '../domain/fees';
import { fulfillPurchase } from '../domain/checkout';

/**
 * E2E test: modify & OVERRIDE a company's (vendor's) fee tiers.
 *
 * Proves, against the real domain code + live global tiers:
 *   1. Baseline — with no override, a vendor's price uses the GLOBAL tier (20%).
 *   2. Override wins — a per-vendor tier beats the global one for the same price.
 *   3. Overwrite in place — updateTier changes the override's rate; NEW purchases
 *      use the new rate.
 *   4. History is frozen — a purchase booked under the OLD rate keeps its old
 *      platform_fee_snapshot even after the tier is changed.
 *   5. Overlap guard — you can't create a second active override on the same range.
 *   6. Deactivate — turning the override off falls the vendor back to the global tier.
 *
 * All seeded under one test vendor + its own override tiers, hard-deleted at the end.
 */

const CATEGORY_ID = '191d2383-4f0f-43ce-9dcc-7137386d2e66';

let passed = 0, failed = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : ''); }
}
const pct = (c: number, price: number) => ((c / price) * 100).toFixed(0) + '%';

async function main() {
  const tag = randomUUID().slice(0, 8);
  console.log(`\n=== Tier override E2E (tag ${tag}) ===\n`);
  const created = { vendorId: '', userId: '', dealId: '', variantId: '', tierId: '', tier2Id: '', txnId: '', claimId: '' };
  const PRICE = 20000; // $200

  try {
    const [vendor] = await sql<{ id: string }[]>`
      INSERT INTO public.vendors (business_name, slug, address_line1, city, region, postal_code, location, stripe_account_status)
      VALUES (${'TEST Tier Spa ' + tag}, ${'test-tier-' + tag}, '1 Test St', 'Testville', 'CA', '90001',
              ST_SetSRID(ST_MakePoint(-118.24, 34.05), 4326)::geography, 'active')
      RETURNING id`;
    created.vendorId = vendor!.id;
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO public.users (clerk_user_id, email, first_name)
      VALUES (${'user_tier_' + tag}, ${tag + '@test.local'}, 'Buyer') RETURNING id`;
    created.userId = user!.id;
    const [deal] = await sql<{ id: string }[]>`
      INSERT INTO public.deals (vendor_id, category_id, title, description, expires_at, status, code_validity_days)
      VALUES (${created.vendorId}, ${CATEGORY_ID}, ${'Tier Deal ' + tag}, 'desc', now() + interval '60 days', 'active', 60)
      RETURNING id`;
    created.dealId = deal!.id;
    const [variant] = await sql<{ id: string }[]>`
      INSERT INTO public.deal_variants (deal_id, label, original_price_cents, deal_price_cents)
      VALUES (${created.dealId}, 'Standard', 40000, ${PRICE}) RETURNING id`;
    created.variantId = variant!.id;

    // ---- 1. baseline: global tier applies ($200 → 20% → $40) ----
    console.log('1. Baseline — no override, uses GLOBAL tier:');
    const base = await computeFee(sql, PRICE, created.vendorId);
    console.log(`   fee ${pct(base.platformFeeCents, PRICE)} = $${(base.platformFeeCents/100).toFixed(0)}  [${base.snapshot.label}]`);
    check('global tier = 20% = $40', base.platformFeeCents === 4000, base.platformFeeCents);
    check('not flagged as an override yet', base.snapshot.label !== 'VIP deal ' + tag);

    // ---- 2. create a per-vendor override (8%) → it WINS over global ----
    console.log('\n2. Create a vendor override at 8% → override wins:');
    const tier = await createTier(sql, {
      label: 'VIP deal ' + tag, minCents: 0, maxCents: 50000, percentBps: 800, vendorId: created.vendorId,
    });
    created.tierId = tier.id;
    const overridden = await computeFee(sql, PRICE, created.vendorId);
    console.log(`   fee now ${pct(overridden.platformFeeCents, PRICE)} = $${(overridden.platformFeeCents/100).toFixed(0)}  [${overridden.snapshot.label}]`);
    check('override applied: 8% = $16', overridden.platformFeeCents === 1600, overridden.platformFeeCents);
    check('vendor payout rose to $184', overridden.vendorPayoutCents === 18400, overridden.vendorPayoutCents);
    check('snapshot names the override tier', overridden.snapshot.label === 'VIP deal ' + tag, overridden.snapshot.label);
    // A DIFFERENT vendor (null override) still gets the global 20%.
    const other = await computeFee(sql, PRICE, randomUUID());
    check('override does NOT leak to other vendors (still 20%)', other.platformFeeCents === 4000, other.platformFeeCents);

    // ---- 3. book a purchase at the 8% rate, then OVERWRITE the tier to 5% ----
    console.log('\n3. Book a sale at 8%, then OVERWRITE the override to 5%:');
    const feeAtBooking = await computeFee(sql, PRICE, created.vendorId);
    const piId = 'pi_TEST_TIER_' + tag;
    const [txn] = await sql<{ id: string }[]>`
      INSERT INTO public.transactions (vendor_id, user_id, consumer_paid_cents, platform_fee_cents, vendor_payout_cents, platform_fee_id, platform_fee_snapshot, stripe_payment_intent_id, status)
      VALUES (${created.vendorId}, ${created.userId}, ${feeAtBooking.consumerPaidCents}, ${feeAtBooking.platformFeeCents}, ${feeAtBooking.vendorPayoutCents}, ${feeAtBooking.platformFeeId}, ${sql.json(feeAtBooking.snapshot)}, ${piId}, 'pending_payment')
      RETURNING id`;
    created.txnId = txn!.id;
    await fulfillPurchase(sql, piId, { userId: created.userId, variantId: created.variantId, dealId: created.dealId, vendorId: created.vendorId, quantity: 1 });
    const [cl] = await sql<{ id: string }[]>`SELECT id FROM public.claims WHERE transaction_id = ${created.txnId}`;
    created.claimId = cl!.id;

    // Overwrite the override: 8% → 5%.
    await updateTier(sql, created.tierId, {
      label: 'VIP deal ' + tag, minCents: 0, maxCents: 50000, percentBps: 500, vendorId: created.vendorId,
    });
    const afterEdit = await computeFee(sql, PRICE, created.vendorId);
    console.log(`   new purchases now ${pct(afterEdit.platformFeeCents, PRICE)} = $${(afterEdit.platformFeeCents/100).toFixed(0)}`);
    check('NEW purchases use the overwritten 5% = $10', afterEdit.platformFeeCents === 1000, afterEdit.platformFeeCents);

    // History must stay frozen at the 8% it was booked at.
    const [booked] = await sql<{ platform_fee_cents: number; snapshot: { percentBps: number } }[]>`
      SELECT platform_fee_cents, platform_fee_snapshot AS snapshot FROM public.transactions WHERE id = ${created.txnId}`;
    console.log(`   the already-booked sale stays frozen at $${(booked!.platform_fee_cents/100).toFixed(0)} (${booked!.snapshot.percentBps/100}%)`);
    check('history frozen: prior sale still $16 (8%)', booked!.platform_fee_cents === 1600, booked!.platform_fee_cents);
    check('frozen snapshot still says 800 bps', booked!.snapshot.percentBps === 800, booked!.snapshot.percentBps);

    // ---- 4. overlap guard: a 2nd active tier on the same range is refused ----
    console.log('\n4. Overlap guard — second active override on the same range:');
    let overlapRefused = false;
    try {
      await createTier(sql, { label: 'dupe ' + tag, minCents: 0, maxCents: 50000, percentBps: 300, vendorId: created.vendorId });
    } catch (e) { overlapRefused = e instanceof TierOverlapError; }
    check('overlapping tier refused', overlapRefused);

    // ---- 5. deactivate the override → falls back to global 20% ----
    console.log('\n5. Deactivate the override → falls back to global:');
    await deactivateTier(sql, created.tierId);
    const afterOff = await computeFee(sql, PRICE, created.vendorId);
    console.log(`   fee back to ${pct(afterOff.platformFeeCents, PRICE)} = $${(afterOff.platformFeeCents/100).toFixed(0)}  [${afterOff.snapshot.label}]`);
    check('override off → back to global 20% = $40', afterOff.platformFeeCents === 4000, afterOff.platformFeeCents);
    check('snapshot no longer the override', afterOff.snapshot.label !== 'VIP deal ' + tag, afterOff.snapshot.label);

    console.log('\n   Summary: global 20% → override 8% → overwrite 5% → deactivate → 20% again. Booked sale stayed frozen at 8%.');
  } finally {
    console.log('\nCleaning up…');
    const vid = created.vendorId || null;
    if (vid) {
      await sql`DELETE FROM public.redemption_attempts WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.audit_log WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.claims WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.transactions WHERE vendor_id = ${vid}`;
      await sql`DELETE FROM public.platform_fees WHERE vendor_id = ${vid}`;
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
