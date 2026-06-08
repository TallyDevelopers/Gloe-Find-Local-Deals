import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { sql } from '../db/client';
import { handleStripeDisputeWebhook } from '../domain/payoutWebhooks';
import { lookupClaimForVendor, RedemptionError } from '../domain/claims';
import { releaseTransferForClaim, TransferRefusedError } from '../domain/payouts';
import { getVendorDetail } from '../domain/admin';
import { getDisputeRiskConfig } from '../domain/platformSettings';

/**
 * GLO-34 end-to-end test. Seeds a minimal vendor→deal→variant→user→transaction
 * →claims graph, drives the REAL dispute domain functions through the full
 * lifecycle, asserts every transition, then hard-deletes everything it created
 * in a finally block (tracked by id) so the live DB is left clean.
 *
 * We use the real `sql` (not a rolled-back tx) because the handler calls
 * sql.begin() internally — the genuine code path we want to exercise.
 */

const CATEGORY_ID = '191d2383-4f0f-43ce-9dcc-7137386d2e66';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : ''); }
}

// settle fire-and-forget audit writes before reading them
const settle = () => new Promise((r) => setTimeout(r, 250));

async function main() {
  const tag = randomUUID().slice(0, 8);
  console.log(`\n=== GLO-34 dispute E2E (tag ${tag}) ===\n`);

  const created = { vendorId: '', userId: '', dealId: '', variantId: '', txnAId: '', txnBId: '', claimAId: '', claimBId: '' };

  try {
    // ---- seed ----
    const [vendor] = await sql<{ id: string }[]>`
      INSERT INTO public.vendors (business_name, slug, address_line1, city, region, postal_code, location, stripe_account_id, stripe_account_status, auto_release_on_redemption)
      VALUES (${'TEST Dispute Spa ' + tag}, ${'test-dispute-' + tag}, '1 Test St', 'Testville', 'CA', '90001',
              ST_SetSRID(ST_MakePoint(-118.24, 34.05), 4326)::geography,
              ${'acct_TEST' + tag.padEnd(16, '0')}, 'active', false)
      RETURNING id`;
    created.vendorId = vendor!.id;

    const [user] = await sql<{ id: string }[]>`
      INSERT INTO public.users (clerk_user_id, email, first_name)
      VALUES (${'user_test_' + tag}, ${tag + '@test.local'}, 'Testy') RETURNING id`;
    created.userId = user!.id;

    const [deal] = await sql<{ id: string }[]>`
      INSERT INTO public.deals (vendor_id, category_id, title, description, expires_at, status, code_validity_days)
      VALUES (${created.vendorId}, ${CATEGORY_ID}, ${'Test Deal ' + tag}, 'desc', now() + interval '60 days', 'active', 60)
      RETURNING id`;
    created.dealId = deal!.id;

    const [variant] = await sql<{ id: string }[]>`
      INSERT INTO public.deal_variants (deal_id, label, original_price_cents, deal_price_cents)
      VALUES (${created.dealId}, 'Standard', 20000, 10000) RETURNING id`;
    created.variantId = variant!.id;

    const snap = (vendorId: string) => sql.json({ dealTitle: 'Test Deal', vendorName: 'TEST Dispute Spa', vendorId });

    // Txn A: paid, unredeemed (the common dispute case).
    const [txnA] = await sql<{ id: string }[]>`
      INSERT INTO public.transactions (vendor_id, user_id, consumer_paid_cents, platform_fee_cents, vendor_payout_cents, stripe_payment_intent_id, status, paid_at)
      VALUES (${created.vendorId}, ${created.userId}, 10000, 2000, 8000, ${'pi_TEST_A_' + tag}, 'paid', now()) RETURNING id`;
    created.txnAId = txnA!.id;
    const [claimA] = await sql<{ id: string }[]>`
      INSERT INTO public.claims (deal_id, vendor_id, variant_id, user_id, status, human_code, qr_payload, snapshot, expires_at, transaction_id)
      VALUES (${created.dealId}, ${created.vendorId}, ${created.variantId}, ${created.userId}, 'active', ${'GLOE-A' + tag.slice(0,4).toUpperCase()}, ${'qr_A_' + tag},
              ${snap(created.vendorId)}, now() + interval '60 days', ${created.txnAId}) RETURNING id`;
    created.claimAId = claimA!.id;

    // Txn B: redeemed + transfer fired (the "vendor already paid" case).
    const [txnB] = await sql<{ id: string }[]>`
      INSERT INTO public.transactions (vendor_id, user_id, consumer_paid_cents, platform_fee_cents, vendor_payout_cents, stripe_payment_intent_id, stripe_transfer_id, status, paid_at, released_at)
      VALUES (${created.vendorId}, ${created.userId}, 10000, 2000, 8000, ${'pi_TEST_B_' + tag}, ${'tr_TEST_B_' + tag}, 'released', now(), now()) RETURNING id`;
    created.txnBId = txnB!.id;
    const [claimB] = await sql<{ id: string }[]>`
      INSERT INTO public.claims (deal_id, vendor_id, variant_id, user_id, status, human_code, qr_payload, snapshot, expires_at, transaction_id, redeemed_at)
      VALUES (${created.dealId}, ${created.vendorId}, ${created.variantId}, ${created.userId}, 'redeemed', ${'GLOE-B' + tag.slice(0,4).toUpperCase()}, ${'qr_B_' + tag},
              ${snap(created.vendorId)}, now() + interval '60 days', ${created.txnBId}, now()) RETURNING id`;
    created.claimBId = claimB!.id;

    console.log('Seeded vendor', created.vendorId, '\n');

    const dispute = (suffix: 'A' | 'B', status: string, type: string) => ({
      type,
      data: { object: { id: 'dp_TEST_' + suffix + '_' + tag, payment_intent: 'pi_TEST_' + suffix + '_' + tag, charge: 'ch_' + suffix + '_' + tag, status, reason: 'fraudulent', amount: 10000 } },
    });

    // ---- 1. dispute.created on the UNREDEEMED order (txn A) ----
    console.log('1. charge.dispute.created on unredeemed order:');
    await handleStripeDisputeWebhook(sql, dispute('A', 'needs_response', 'charge.dispute.created') as never);
    const [aClaim] = await sql<{ status: string }[]>`SELECT status FROM public.claims WHERE id = ${created.claimAId}`;
    const [aTxn] = await sql<{ status: string; stripe_dispute_id: string | null; disputed_at: string | null }[]>`SELECT status, stripe_dispute_id, disputed_at FROM public.transactions WHERE id = ${created.txnAId}`;
    check('voucher frozen', aClaim!.status === 'frozen', aClaim);
    check('transaction → disputed', aTxn!.status === 'disputed', aTxn);
    check('dispute id recorded', !!aTxn!.stripe_dispute_id);
    check('disputed_at set', !!aTxn!.disputed_at);

    let refused = false;
    try { await lookupClaimForVendor(sql, created.vendorId, created.userId, 'qr_A_' + tag); }
    catch (e) { refused = e instanceof RedemptionError; }
    check('redemption refused on frozen voucher', refused);

    let releaseRefused = false;
    try { await releaseTransferForClaim(sql, created.claimAId); }
    catch (e) { releaseRefused = e instanceof TransferRefusedError; }
    check('payout release refused while disputed', releaseRefused);

    // ---- 2. dispute.created on the ALREADY-REDEEMED order (txn B) ----
    console.log('\n2. charge.dispute.created on already-redeemed order:');
    await handleStripeDisputeWebhook(sql, dispute('B', 'needs_response', 'charge.dispute.created') as never);
    const [bClaim] = await sql<{ status: string }[]>`SELECT status FROM public.claims WHERE id = ${created.claimBId}`;
    const [bTxn] = await sql<{ status: string }[]>`SELECT status FROM public.transactions WHERE id = ${created.txnBId}`;
    check('redeemed voucher left as redeemed (not frozen)', bClaim!.status === 'redeemed', bClaim);
    check('transaction → disputed', bTxn!.status === 'disputed', bTxn);
    await settle();
    const [bAudit] = await sql<{ action: string; meta: Record<string, unknown> }[]>`
      SELECT action, meta FROM public.audit_log WHERE transaction_id = ${created.txnBId} AND action LIKE 'dispute%' ORDER BY created_at DESC LIMIT 1`;
    check('audit = dispute.opened_redeemed', bAudit?.action === 'dispute.opened_redeemed', bAudit?.action);
    check('flagged needsAdminReview', bAudit?.meta?.needsAdminReview === true, bAudit?.meta);

    // ---- 3. dispute.closed WON on txn A → unfreeze ----
    console.log('\n3. charge.dispute.closed (won) on txn A:');
    await handleStripeDisputeWebhook(sql, dispute('A', 'won', 'charge.dispute.closed') as never);
    const [aClaim2] = await sql<{ status: string }[]>`SELECT status FROM public.claims WHERE id = ${created.claimAId}`;
    const [aTxn2] = await sql<{ status: string; dispute_resolved_at: string | null }[]>`SELECT status, dispute_resolved_at FROM public.transactions WHERE id = ${created.txnAId}`;
    check('voucher un-frozen → active', aClaim2!.status === 'active', aClaim2);
    check('transaction restored → paid', aTxn2!.status === 'paid', aTxn2);
    check('dispute_resolved_at set', !!aTxn2!.dispute_resolved_at);

    let worksAgain = false;
    try { const r = await lookupClaimForVendor(sql, created.vendorId, created.userId, 'qr_A_' + tag); worksAgain = r.status === 'active'; }
    catch { worksAgain = false; }
    check('redemption allowed again after win', worksAgain);

    // ---- 4. dispute.closed LOST on txn B → freeze stands, flagged ----
    console.log('\n4. charge.dispute.closed (lost) on txn B:');
    await handleStripeDisputeWebhook(sql, dispute('B', 'lost', 'charge.dispute.closed') as never);
    const [bTxn2] = await sql<{ status: string; dispute_status: string | null }[]>`SELECT status, dispute_status FROM public.transactions WHERE id = ${created.txnBId}`;
    check('transaction stays disputed after loss', bTxn2!.status === 'disputed', bTxn2);
    check('dispute_status = lost', bTxn2!.dispute_status === 'lost', bTxn2);
    await settle();
    const [bLostAudit] = await sql<{ action: string }[]>`SELECT action FROM public.audit_log WHERE transaction_id = ${created.txnBId} AND action = 'dispute.lost' LIMIT 1`;
    check('audit dispute.lost written', !!bLostAudit);

    // ---- 5. dispute-risk scorecard + config flag ----
    console.log('\n5. dispute-risk scorecard (getVendorDetail):');
    const cfg = await getDisputeRiskConfig(sql);
    console.log(`   policy: enabled=${cfg.enabled} maxDisputes=${cfg.maxDisputes} windowDays=${cfg.windowDays}`);
    const detail = await getVendorDetail(sql, created.vendorId);
    check('disputeTotal = 2', detail!.vendor.disputeTotal === 2, detail!.vendor.disputeTotal);
    check('disputeInWindow = 2', detail!.vendor.disputeInWindow === 2, detail!.vendor.disputeInWindow);
    check('disputeLost = 1', detail!.vendor.disputeLost === 1, detail!.vendor.disputeLost);
    check('disputeOpen = 1 (txn B still disputed)', detail!.vendor.disputeOpen === 1, detail!.vendor.disputeOpen);
    check('isHighDisputeRisk reflects policy',
      detail!.vendor.isHighDisputeRisk === (cfg.enabled && 2 > cfg.maxDisputes),
      { isHigh: detail!.vendor.isHighDisputeRisk, max: cfg.maxDisputes });
    check('disputeRiskConfig echoed back', detail!.vendor.disputeRiskConfig.maxDisputes === cfg.maxDisputes);
    check('disputeRate computed', typeof detail!.vendor.disputeRate === 'number' && detail!.vendor.disputeRate > 0, detail!.vendor.disputeRate);
  } finally {
    // Hard cleanup — children first. audit_log rows reference txn/vendor; clear them too.
    console.log('\nCleaning up test data…');
    if (created.txnAId || created.txnBId) {
      await sql`DELETE FROM public.audit_log WHERE transaction_id IN (${created.txnAId || null}, ${created.txnBId || null}) OR vendor_id = ${created.vendorId || null}`;
    }
    if (created.claimAId || created.claimBId) {
      // lookupClaimForVendor logs redemption_attempts that FK the claim — clear first.
      await sql`DELETE FROM public.redemption_attempts WHERE claim_id IN (${created.claimAId || null}, ${created.claimBId || null}) OR vendor_id = ${created.vendorId || null}`;
      await sql`DELETE FROM public.claims WHERE id IN (${created.claimAId || null}, ${created.claimBId || null})`;
    }
    if (created.txnAId || created.txnBId) await sql`DELETE FROM public.transactions WHERE id IN (${created.txnAId || null}, ${created.txnBId || null})`;
    if (created.variantId) await sql`DELETE FROM public.deal_variants WHERE id = ${created.variantId}`;
    if (created.dealId) await sql`DELETE FROM public.deals WHERE id = ${created.dealId}`;
    if (created.userId) await sql`DELETE FROM public.users WHERE id = ${created.userId}`;
    if (created.vendorId) await sql`DELETE FROM public.vendors WHERE id = ${created.vendorId}`;
    console.log('Cleaned up.');
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
