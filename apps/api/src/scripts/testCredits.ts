import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { sql } from '../db/client';
import {
  computeApplicableCredits,
  expireOverdueLots,
  forfeitAllForUser,
  grantCredit,
  redeemCreditsForTransaction,
  unwindCreditsForTransaction,
} from '../domain/credits';
import {
  attributeSignup,
  ensureReferralCode,
  hashEmailForDeletionGuard,
  maybePayoutReferrerOnFirstPurchase,
} from '../domain/referrals';
import { createPurchase, fulfillPurchase } from '../domain/checkout';
import { refundTransaction } from '../domain/vendorOps';
import { handleStripeDisputeWebhook } from '../domain/payoutWebhooks';

/**
 * GLO-24 credits-platform domain test (testDispute.ts sibling). Seeds a
 * minimal vendor→deal→variant graph plus per-scenario users, drives the REAL
 * domain functions through the money paths, asserts every transition, then
 * hard-deletes everything it created in a finally block (tracked by id) so
 * the DB is left clean.
 *
 * REQUIRES the 20260610120000_credits_platform.sql migration to be applied —
 * do NOT run this against a database that hasn't taken it yet.
 *
 * NOTE: this inserts a TEST referral rule (same $20/$20/$50 economics as the
 * seed, but monthly_referral_payout_cap=1 so the cap is testable) which is the
 * newest active rule for the few seconds the test runs. The only live-traffic
 * effect in that window is a TIGHTER referrer cap — failsafe direction.
 *
 * No Stripe calls go out: the refund test pre-exhausts the cash share so the
 * split-tender refund is credit-only, and the dispute webhook is driven with
 * synthetic events (the same trick as testDispute.ts).
 *
 * Run: npx tsx src/scripts/testCredits.ts
 */

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : ''); }
}

// settle fire-and-forget audit writes / referral payouts before reading them
// (the payout check is ~8 round trips to the pooler — give it real headroom)
const settle = () => new Promise((r) => setTimeout(r, 700));

const DAY_MS = 86_400_000;

async function balance(userId: string): Promise<number> {
  const rows = await sql<{ total: number }[]>`
    SELECT COALESCE(SUM(remaining_cents), 0)::int AS total
    FROM public.credit_lots WHERE user_id = ${userId}
  `;
  return rows[0]!.total;
}

/** computeApplicableCredits must run inside a txn (FOR UPDATE) — wrap it. */
function applicable(userId: string, orderTotalCents: number): Promise<number> {
  return sql.begin((tx) => computeApplicableCredits(tx, { userId, orderTotalCents }));
}

async function main() {
  const tag = randomUUID().slice(0, 8);
  console.log(`\n=== GLO-24 credits E2E (tag ${tag}) ===\n`);

  const userIds: string[] = [];
  const created = { vendorId: '', dealId: '', variantId: '', ruleId: '', deletedEmailHash: '' };

  const newUser = async (role: string): Promise<string> => {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO public.users (clerk_user_id, email, first_name)
      VALUES (${'user_cr_' + role + '_' + tag}, ${role + '.' + tag + '@test.local'}, ${role})
      RETURNING id`;
    userIds.push(rows[0]!.id);
    return rows[0]!.id;
  };

  // Seed a pending/paid transaction directly (what createPurchase would write).
  const newTxn = async (args: {
    userId: string; consumerPaidCents: number; creditsAppliedCents?: number;
    piId?: string | null; status?: string; paidAt?: boolean; cardFingerprint?: string | null;
  }): Promise<string> => {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO public.transactions (
        vendor_id, user_id, consumer_paid_cents, platform_fee_cents, vendor_payout_cents,
        credits_applied_cents, stripe_payment_intent_id, card_fingerprint, status, paid_at
      ) VALUES (
        ${created.vendorId}, ${args.userId}, ${args.consumerPaidCents},
        ${Math.floor(args.consumerPaidCents / 5)}, ${args.consumerPaidCents - Math.floor(args.consumerPaidCents / 5)},
        ${args.creditsAppliedCents ?? 0}, ${args.piId ?? null}, ${args.cardFingerprint ?? null},
        ${args.status ?? 'pending_payment'}, ${args.paidAt ? sql`now()` : null}
      ) RETURNING id`;
    return rows[0]!.id;
  };

  const fulfillMeta = (userId: string, cardFingerprint?: string) => ({
    userId,
    variantId: created.variantId,
    dealId: created.dealId,
    vendorId: created.vendorId,
    quantity: 1,
    cardFingerprint: cardFingerprint ?? null,
  });

  try {
    // ---- seed: one vendor/deal/variant everything hangs off ----
    const [vendor] = await sql<{ id: string }[]>`
      INSERT INTO public.vendors (business_name, slug, address_line1, city, region, postal_code, location, stripe_account_id, stripe_account_status, auto_release_on_redemption)
      VALUES (${'TEST Credits Spa ' + tag}, ${'test-credits-' + tag}, '1 Test St', 'Testville', 'CA', '90001',
              ST_SetSRID(ST_MakePoint(-118.24, 34.05), 4326)::geography,
              ${'acct_TEST' + tag.padEnd(16, '0')}, 'active', false)
      RETURNING id`;
    created.vendorId = vendor!.id;

    const [category] = await sql<{ id: string }[]>`
      SELECT id FROM public.service_categories LIMIT 1`;
    const [deal] = await sql<{ id: string }[]>`
      INSERT INTO public.deals (vendor_id, category_id, title, description, expires_at, status, code_validity_days)
      VALUES (${created.vendorId}, ${category!.id}, ${'Credits Deal ' + tag}, 'desc', now() + interval '60 days', 'active', 60)
      RETURNING id`;
    created.dealId = deal!.id;

    const [variant] = await sql<{ id: string }[]>`
      INSERT INTO public.deal_variants (deal_id, label, original_price_cents, deal_price_cents)
      VALUES (${created.dealId}, 'Standard', 4000, 2000) RETURNING id`;
    created.variantId = variant!.id;

    // Deterministic referral economics (same as the seed rule, payout cap 1).
    const RULE = { give: 2000, get: 2000, floor: 5000, days: 90, userCap: 10000, payoutCap: 1 };
    const [rule] = await sql<{ id: string }[]>`
      INSERT INTO public.credit_rules
        (rule_type, give_cents, get_cents, min_first_purchase_cents,
         expires_after_days, monthly_user_cap_cents, monthly_referral_payout_cap, active)
      VALUES ('referral', ${RULE.give}, ${RULE.get}, ${RULE.floor},
              ${RULE.days}, ${RULE.userCap}, ${RULE.payoutCap}, true)
      RETURNING id`;
    created.ruleId = rule!.id;

    console.log('Seeded vendor', created.vendorId, '\n');

    // ---- 1. grantCredit idempotency walls ----
    console.log('1. grantCredit idempotency (the one door):');
    const u1 = await newUser('grant');
    const t1 = await newTxn({ userId: u1, consumerPaidCents: 10000, status: 'paid', paidAt: true });

    const g1 = await grantCredit(sql, { userId: u1, kind: 'purchase_reward', amountCents: 1000, transactionId: t1 });
    const g2 = await grantCredit(sql, { userId: u1, kind: 'purchase_reward', amountCents: 1000, transactionId: t1 });
    check('first grant lands', g1.granted && !g1.duplicate && !!g1.lotId, g1);
    check('same kind+txn retry absorbed as duplicate', !g2.granted && g2.duplicate, g2);
    const txnLots = await sql<{ id: string }[]>`
      SELECT id FROM public.credit_lots WHERE transaction_id = ${t1} AND kind = 'purchase_reward'`;
    check('exactly one lot for the kind+txn pair', txnLots.length === 1, txnLots.length);

    const r1 = await grantCredit(sql, { userId: u1, kind: 'referral_give', amountCents: 500, referralId: u1 });
    const r2 = await grantCredit(sql, { userId: u1, kind: 'referral_give', amountCents: 500, referralId: u1 });
    check('kind+referral wall holds too', r1.granted && r2.duplicate, { r1, r2 });

    // ---- 2. FIFO redemption: soonest expiry first, NULLS LAST ----
    console.log('\n2. FIFO redemption across lots (expiry ordering):');
    const u2 = await newUser('fifo');
    const perpetual = await grantCredit(sql, { userId: u2, kind: 'admin_grant', amountCents: 1000 });
    const far = await grantCredit(sql, { userId: u2, kind: 'promo', amountCents: 1000, expiresAfterDays: 40 });
    const soon = await grantCredit(sql, { userId: u2, kind: 'admin_grant', amountCents: 1000, expiresAfterDays: 10 });

    const tA = await newTxn({ userId: u2, consumerPaidCents: 1500, creditsAppliedCents: 1500, status: 'paid', paidAt: true });
    const sumA = await sql.begin((tx) =>
      redeemCreditsForTransaction(tx, { userId: u2, transactionId: tA, amountCents: 1500, orderTotalCents: 1500 }));
    check('redeemed the full reservation', sumA.redeemedCents === 1500 && sumA.shortfallCents === 0, sumA);
    check('soonest-expiring lot consumed first', sumA.lots[0]?.lotId === soon.lotId && sumA.lots[0]?.cents === 1000, sumA.lots);
    check('then the next expiry', sumA.lots[1]?.lotId === far.lotId && sumA.lots[1]?.cents === 500, sumA.lots);
    const lotsAfterA = await sql<{ id: string; remaining_cents: number }[]>`
      SELECT id, remaining_cents FROM public.credit_lots WHERE user_id = ${u2}`;
    const rem = (id: string | null) => lotsAfterA.find((l) => l.id === id)?.remaining_cents;
    check('perpetual lot untouched (NULLS LAST)', rem(perpetual.lotId) === 1000, lotsAfterA);

    const sumA2 = await sql.begin((tx) =>
      redeemCreditsForTransaction(tx, { userId: u2, transactionId: tA, amountCents: 1500, orderTotalCents: 1500 }));
    check('re-redeeming the same txn is a no-op (webhook retry)', sumA2.redeemedCents === 0 && sumA2.lots.length === 0, sumA2);

    const tB = await newTxn({ userId: u2, consumerPaidCents: 1200, creditsAppliedCents: 1200, status: 'paid', paidAt: true });
    const sumB = await sql.begin((tx) =>
      redeemCreditsForTransaction(tx, { userId: u2, transactionId: tB, amountCents: 1200, orderTotalCents: 1200 }));
    check('second txn drains the dated lot then dips into perpetual',
      sumB.lots[0]?.lotId === far.lotId && sumB.lots[0]?.cents === 500
      && sumB.lots[1]?.lotId === perpetual.lotId && sumB.lots[1]?.cents === 700, sumB.lots);
    check('balance after both redemptions = 300', (await balance(u2)) === 300);

    // Clawback debt nets the spendable balance.
    const uNeg = await newUser('negnet');
    await grantCredit(sql, { userId: uNeg, kind: 'admin_grant', amountCents: 1000 });
    const debt = await grantCredit(sql, { userId: uNeg, kind: 'promo', amountCents: 400 });
    await sql`UPDATE public.credit_lots SET remaining_cents = -400 WHERE id = ${debt.lotId}`;
    check('negative lot nets the spend cap (1000 − 400 = 600)', (await applicable(uNeg, 5000)) === 600);

    // ---- 3. Stripe 50¢ floor math ----
    console.log('\n3. 50¢ floor (never leave 0 < cash < 50):');
    const u3 = await newUser('floor');
    await grantCredit(sql, { userId: u3, kind: 'admin_grant', amountCents: 2000 });
    check('cash-rich order applies full balance', (await applicable(u3, 5000)) === 2000);
    check('exact cover → zero-dollar path is fine', (await applicable(u3, 2000)) === 2000);
    check('balance > order → applies the order total', (await applicable(u3, 1990)) === 1990);
    check('cash would be 30¢ → shaved so cash = exactly 50¢', (await applicable(u3, 2030)) === 1980);
    check('cash would be 49¢ → shaved to 50¢', (await applicable(u3, 2049)) === 1999);
    check('cash would be exactly 50¢ → untouched', (await applicable(u3, 2050)) === 2000);

    // ---- 4. zero-dollar checkout (inline fulfillment, no Stripe) ----
    console.log('\n4. zero-dollar order skips Stripe and fulfills inline:');
    const u4 = await newUser('zero');
    await grantCredit(sql, { userId: u4, kind: 'admin_grant', amountCents: 2500 });
    const purchase = await createPurchase(sql, { userId: u4, variantId: created.variantId, quantity: 1 });
    check('paidWithCredits marker set, no client secret / PI',
      purchase.paidWithCredits && purchase.clientSecret === null && purchase.paymentIntentId === null, purchase);
    check('cash charged = 0, credits = full price', purchase.amountCents === 0 && purchase.creditsAppliedCents === 2000, purchase);
    const [zeroTxn] = await sql<{ status: string; paid_at: string | null; stripe_payment_intent_id: string | null; credits_applied_cents: number }[]>`
      SELECT status, paid_at, stripe_payment_intent_id, credits_applied_cents
      FROM public.transactions WHERE id = ${purchase.transactionId}`;
    check('txn paid inline, no Stripe id', zeroTxn!.status === 'paid' && !!zeroTxn!.paid_at && zeroTxn!.stripe_payment_intent_id === null, zeroTxn);
    const zeroClaims = await sql<{ status: string }[]>`
      SELECT status FROM public.claims WHERE transaction_id = ${purchase.transactionId}`;
    check('voucher minted and active', zeroClaims.length === 1 && zeroClaims[0]!.status === 'active', zeroClaims);
    check('lot drawn down to 500', (await balance(u4)) === 500);

    // ---- 5. referral attribution + the referee's locked lot ----
    console.log('\n5. attribution + referee lock (blocked under floor, applies at floor):');
    const referrer1 = await newUser('ref1');
    const code1 = await ensureReferralCode(sql, referrer1);
    const referee1 = await newUser('reff1');

    const att = await attributeSignup(sql, { userId: referee1, code: ' ' + code1.toLowerCase() + ' ', email: 'reff1.' + tag + '@test.local' });
    check('attribution succeeds (code normalized)', att.attributed && att.reason === 'attributed', att);
    const [linked] = await sql<{ referred_by: string | null }[]>`
      SELECT referred_by FROM public.users WHERE id = ${referee1}`;
    check('referred_by set', linked!.referred_by === referrer1, linked);
    const giveLots1 = await sql<{ id: string; amount_cents: number; rule_id: string | null }[]>`
      SELECT id, amount_cents, rule_id FROM public.credit_lots
      WHERE user_id = ${referee1} AND kind = 'referral_give'`;
    check('give lot minted at rule amount, tied to the rule',
      giveLots1.length === 1 && giveLots1[0]!.amount_cents === RULE.give && giveLots1[0]!.rule_id === created.ruleId, giveLots1);

    check('locked below the first-order floor', (await applicable(referee1, RULE.floor - 1)) === 0);
    check('applies at the floor', (await applicable(referee1, RULE.floor)) === RULE.give);

    const selfAtt = await attributeSignup(sql, { userId: referrer1, code: code1, email: null });
    check('self-referral refused', !selfAtt.attributed && selfAtt.reason === 'self_referral', selfAtt);
    const reAtt = await attributeSignup(sql, { userId: referee1, code: code1, email: null });
    check('double attribution refused', !reAtt.attributed && reAtt.reason === 'already_attributed', reAtt);

    // Deleted-account guard: a hashed email means "not genuinely new".
    const ghostEmail = 'ghost.' + tag + '@test.local';
    created.deletedEmailHash = hashEmailForDeletionGuard(ghostEmail);
    await sql`INSERT INTO public.deleted_account_email_hashes (email_hash) VALUES (${created.deletedEmailHash}) ON CONFLICT DO NOTHING`;
    const ghost = await newUser('ghost');
    const ghostAtt = await attributeSignup(sql, { userId: ghost, code: code1, email: ghostEmail });
    check('previously-deleted email refused (no lot, no link)',
      !ghostAtt.attributed && ghostAtt.reason === 'previously_deleted_account', ghostAtt);
    check('ghost got no credit', (await balance(ghost)) === 0);

    // ---- 6. referrer payout guards on the referee's first purchase ----
    console.log('\n6. referrer payout guards (floor / fingerprint / caps):');

    // 6a. first purchase below the floor → refused, lot permanently locked.
    const referrer2 = await newUser('ref2');
    const code2 = await ensureReferralCode(sql, referrer2);
    const referee2 = await newUser('reff2');
    await attributeSignup(sql, { userId: referee2, code: code2, email: null });
    const txE3 = await newTxn({ userId: referee2, consumerPaidCents: 4000, piId: 'pi_TESTCR_E3_' + tag });
    await fulfillPurchase(sql, 'pi_TESTCR_E3_' + tag, fulfillMeta(referee2));
    await settle();
    check('no payout below floor', (await balance(referrer2)) === 0);
    const [floorAudit] = await sql<{ meta: Record<string, unknown> }[]>`
      SELECT meta FROM public.audit_log
      WHERE transaction_id = ${txE3} AND action = 'referral.payout_refused' LIMIT 1`;
    check('refusal audited as first_purchase_below_floor', floorAudit?.meta?.reason === 'first_purchase_below_floor', floorAudit?.meta);
    check('give lot now dead (first purchase spent without it)', (await applicable(referee2, 6000)) === 0);

    // 6b. card-fingerprint match → payout VOIDED, referee keeps theirs.
    const referrer3 = await newUser('ref3');
    const code3 = await ensureReferralCode(sql, referrer3);
    const referee3 = await newUser('reff3');
    await attributeSignup(sql, { userId: referee3, code: code3, email: null });
    const fp = 'fp_TESTCR_' + tag;
    await newTxn({ userId: referrer3, consumerPaidCents: 5000, piId: 'pi_TESTCR_R3_' + tag, status: 'paid', paidAt: true, cardFingerprint: fp });
    const txE4 = await newTxn({ userId: referee3, consumerPaidCents: 5000, creditsAppliedCents: RULE.give, piId: 'pi_TESTCR_E4_' + tag });
    await fulfillPurchase(sql, 'pi_TESTCR_E4_' + tag, fulfillMeta(referee3, fp));
    await settle();
    check('referrer payout voided on fingerprint match', (await balance(referrer3)) === 0);
    const [voidAudit] = await sql<{ meta: Record<string, unknown> }[]>`
      SELECT meta FROM public.audit_log
      WHERE transaction_id = ${txE4} AND action = 'referral.payout_voided' LIMIT 1`;
    check('void audited with the fingerprint', voidAudit?.meta?.cardFingerprint === fp, voidAudit?.meta);
    const e4Spend = await sql<{ amount_cents: number }[]>`
      SELECT amount_cents FROM public.credit_entries
      WHERE transaction_id = ${txE4} AND kind = 'redemption'`;
    check('referee kept (and spent) their welcome credit', e4Spend[0]?.amount_cents === -RULE.give, e4Spend);

    // 6c. happy path: floor met, clean card → referrer paid once.
    const referrer4 = await newUser('ref4');
    const code4 = await ensureReferralCode(sql, referrer4);
    const referee4 = await newUser('reff4');
    await attributeSignup(sql, { userId: referee4, code: code4, email: null });
    const txE5 = await newTxn({ userId: referee4, consumerPaidCents: 5000, creditsAppliedCents: RULE.give, piId: 'pi_TESTCR_E5_' + tag });
    await fulfillPurchase(sql, 'pi_TESTCR_E5_' + tag, fulfillMeta(referee4, 'fp_e5_' + tag));
    await settle();
    const getLots4 = await sql<{ id: string; amount_cents: number; transaction_id: string | null; referral_id: string | null }[]>`
      SELECT id, amount_cents, transaction_id, referral_id FROM public.credit_lots
      WHERE user_id = ${referrer4} AND kind = 'referral_get'`;
    check('referrer paid the get amount, keyed to the qualifying txn + referee',
      getLots4.length === 1 && getLots4[0]!.amount_cents === RULE.get
      && getLots4[0]!.transaction_id === txE5 && getLots4[0]!.referral_id === referee4, getLots4);
    check('referee\'s give lot consumed by the purchase', (await balance(referee4)) === 0);

    await maybePayoutReferrerOnFirstPurchase(sql, txE5); // direct retry
    await settle();
    const getCount4 = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM public.credit_lots WHERE user_id = ${referrer4} AND kind = 'referral_get'`;
    check('payout retry absorbed by the (kind, referral) wall', getCount4[0]!.count === 1);

    // 6d. monthly payout-count cap (test rule caps at 1).
    const referee5 = await newUser('reff5');
    await attributeSignup(sql, { userId: referee5, code: code4, email: null });
    const txE6 = await newTxn({ userId: referee5, consumerPaidCents: 5000, creditsAppliedCents: RULE.give, piId: 'pi_TESTCR_E6_' + tag });
    await fulfillPurchase(sql, 'pi_TESTCR_E6_' + tag, fulfillMeta(referee5, 'fp_e6_' + tag));
    await settle();
    check('second payout this month refused (cap=1)', (await balance(referrer4)) === RULE.get);
    const [capAudit] = await sql<{ meta: Record<string, unknown> }[]>`
      SELECT meta FROM public.audit_log
      WHERE transaction_id = ${txE6} AND action = 'referral.payout_refused' LIMIT 1`;
    check('refusal audited as monthly_payout_cap', capAudit?.meta?.reason === 'monthly_payout_cap', capAudit?.meta);

    // 6e. monthly user-cap (cents) on the referrer's capped-earn pool.
    const referrer5 = await newUser('ref5');
    const code5 = await ensureReferralCode(sql, referrer5);
    await grantCredit(sql, { userId: referrer5, kind: 'signup_bonus', amountCents: RULE.userCap });
    const referee6 = await newUser('reff6');
    await attributeSignup(sql, { userId: referee6, code: code5, email: null });
    const txE7 = await newTxn({ userId: referee6, consumerPaidCents: 5000, creditsAppliedCents: RULE.give, piId: 'pi_TESTCR_E7_' + tag });
    await fulfillPurchase(sql, 'pi_TESTCR_E7_' + tag, fulfillMeta(referee6, 'fp_e7_' + tag));
    await settle();
    check('payout refused once the monthly cents cap is full', (await balance(referrer5)) === RULE.userCap);
    const [centsCapAudit] = await sql<{ meta: Record<string, unknown> }[]>`
      SELECT meta FROM public.audit_log
      WHERE transaction_id = ${txE7} AND action = 'referral.payout_refused' LIMIT 1`;
    check('refusal audited as monthly_cap', centsCapAudit?.meta?.reason === 'monthly_cap', centsCapAudit?.meta);

    // ---- 7. split-tender refund: credit share returns + earned lots claw back ----
    console.log('\n7. split-tender refund (returns credits ≥30d; claws back the referral pair):');
    // E5 was the referee4↔referrer4 qualifying purchase ($50 = $30 cash + $20
    // credit). Pretend the cash leg was already refunded so the remaining
    // refund is credit-only and no live Stripe call goes out.
    await sql`
      UPDATE public.transactions
      SET refunded_cents = 3000, status = 'partially_refunded', refunded_at = now(), updated_at = now()
      WHERE id = ${txE5}`;
    const refund = await refundTransaction(sql, txE5, 2000, referee4, 'test split-tender refund');
    check('refund accepted, credit-only leg (no Stripe id)', refund.refunded && refund.stripeRefundId === null, refund);
    check('counts as the FULL refund of what remained', refund.isFullRefund === true, refund);

    const [refundedTxn] = await sql<{ status: string; credits_refunded_cents: number }[]>`
      SELECT status, credits_refunded_cents FROM public.transactions WHERE id = ${txE5}`;
    check('txn → refunded with credits_refunded recorded',
      refundedTxn!.status === 'refunded' && refundedTxn!.credits_refunded_cents === 2000, refundedTxn);
    const [refundedClaim] = await sql<{ status: string }[]>`
      SELECT status FROM public.claims WHERE transaction_id = ${txE5}`;
    check('voucher cancelled on full refund', refundedClaim!.status === 'cancelled', refundedClaim);

    const returnLots = await sql<{ amount_cents: number; expires_at: string | null }[]>`
      SELECT amount_cents, expires_at FROM public.credit_lots
      WHERE user_id = ${referee4} AND kind = 'refund_return' AND transaction_id = ${txE5}`;
    const returnExpiry = returnLots[0]?.expires_at ? new Date(returnLots[0].expires_at).getTime() : 0;
    check('credit share returned as a refund_return lot', returnLots.length === 1 && returnLots[0]!.amount_cents === 2000, returnLots);
    check('returned lot expiry ≥ 30 days out', returnExpiry >= Date.now() + 30 * DAY_MS - 3_600_000, returnLots[0]?.expires_at);

    await settle();
    const giveLot4 = await sql<{ remaining_cents: number }[]>`
      SELECT remaining_cents FROM public.credit_lots
      WHERE user_id = ${referee4} AND kind = 'referral_give'`;
    check('referee\'s earned give lot clawed NEGATIVE (was already spent)', giveLot4[0]?.remaining_cents === -RULE.give, giveLot4);
    const getLot4 = await sql<{ remaining_cents: number }[]>`
      SELECT remaining_cents FROM public.credit_lots
      WHERE user_id = ${referrer4} AND kind = 'referral_get' AND transaction_id = ${txE5}`;
    check('referrer\'s get lot clawed to zero', getLot4[0]?.remaining_cents === 0, getLot4);
    const clawEntries = await sql<{ amount_cents: number }[]>`
      SELECT amount_cents FROM public.credit_entries
      WHERE transaction_id = ${txE5} AND kind = 'clawback' ORDER BY amount_cents`;
    check('one clawback entry per side of the pair',
      clawEntries.length === 2 && clawEntries.every((e) => e.amount_cents === -2000), clawEntries);
    check('referee nets to zero (return − clawed earn)', (await balance(referee4)) === 0);

    const reclaw = await unwindCreditsForTransaction(sql, txE5, 'refund', referee4);
    check('unwind is idempotent (refund-then-dispute can\'t double-claw)', reclaw.clawedCents === 0 && reclaw.lotCount === 0, reclaw);

    // 30-day floor: a consumed lot expiring in 5 days returns with ~30 days.
    const u7 = await newUser('retfloor');
    await grantCredit(sql, { userId: u7, kind: 'promo', amountCents: 2000, expiresAfterDays: 5 });
    const txF = await newTxn({ userId: u7, consumerPaidCents: 5000, creditsAppliedCents: 2000, piId: 'pi_TESTCR_F_' + tag });
    await fulfillPurchase(sql, 'pi_TESTCR_F_' + tag, fulfillMeta(u7));
    await sql`
      UPDATE public.transactions
      SET refunded_cents = 3000, status = 'partially_refunded', refunded_at = now(), updated_at = now()
      WHERE id = ${txF}`;
    await refundTransaction(sql, txF, 2000, u7, 'test 30d floor');
    const [floorLot] = await sql<{ expires_at: string | null }[]>`
      SELECT expires_at FROM public.credit_lots
      WHERE user_id = ${u7} AND kind = 'refund_return' AND transaction_id = ${txF}`;
    const floorMs = floorLot?.expires_at ? new Date(floorLot.expires_at).getTime() : 0;
    check('short-dated source lot → return floored to ~30 days',
      floorMs >= Date.now() + 29 * DAY_MS && floorMs <= Date.now() + 31 * DAY_MS, floorLot?.expires_at);

    // ---- 8. dispute freeze blocks redemption; won → thaw ----
    console.log('\n8. dispute freeze:');
    const u8 = await newUser('dispute');
    await grantCredit(sql, { userId: u8, kind: 'promo', amountCents: 2000 });
    const txD = await newTxn({ userId: u8, consumerPaidCents: 5000, piId: 'pi_TESTCR_D_' + tag, status: 'paid', paidAt: true });
    await sql`
      INSERT INTO public.claims (deal_id, vendor_id, variant_id, user_id, status, human_code, qr_payload, snapshot, expires_at, transaction_id)
      VALUES (${created.dealId}, ${created.vendorId}, ${created.variantId}, ${u8}, 'active',
              ${'GLOE-D' + tag.slice(0, 4).toUpperCase()}, ${'qr_D_' + tag},
              ${sql.json({ dealTitle: 'Credits Deal', vendorName: 'TEST Credits Spa', vendorId: created.vendorId })},
              now() + interval '60 days', ${txD})`;
    check('spendable before the dispute', (await applicable(u8, 5000)) === 2000);

    const disputeEvent = (status: string, type: string) => ({
      type,
      data: { object: { id: 'dp_TESTCR_' + tag, payment_intent: 'pi_TESTCR_D_' + tag, charge: 'ch_TESTCR_' + tag, status, reason: 'fraudulent', amount: 5000 } },
    });
    await handleStripeDisputeWebhook(sql, disputeEvent('needs_response', 'charge.dispute.created') as never);
    const [frozenUser] = await sql<{ credit_frozen_at: string | null }[]>`
      SELECT credit_frozen_at FROM public.users WHERE id = ${u8}`;
    check('ledger frozen on dispute.created', !!frozenUser!.credit_frozen_at, frozenUser);
    check('frozen ledger refuses redemption', (await applicable(u8, 5000)) === 0);

    await handleStripeDisputeWebhook(sql, disputeEvent('won', 'charge.dispute.closed') as never);
    const [thawedUser] = await sql<{ credit_frozen_at: string | null }[]>`
      SELECT credit_frozen_at FROM public.users WHERE id = ${u8}`;
    check('won → ledger thawed', thawedUser!.credit_frozen_at === null, thawedUser);
    check('spendable again after the win', (await applicable(u8, 5000)) === 2000);

    // ---- 9. account-deletion forfeiture zeroes positive lots only ----
    console.log('\n9. forfeiture:');
    const u9 = await newUser('forfeit');
    await grantCredit(sql, { userId: u9, kind: 'admin_grant', amountCents: 1000 });
    await grantCredit(sql, { userId: u9, kind: 'promo', amountCents: 500 });
    const debt9 = await grantCredit(sql, { userId: u9, kind: 'promo', amountCents: 400, note: 'becomes debt' });
    await sql`UPDATE public.credit_lots SET remaining_cents = -400 WHERE id = ${debt9.lotId}`;

    const forfeited = await forfeitAllForUser(sql, u9, { actorUserId: u9, reason: 'account_deleted' });
    check('forfeits the positive lots only ($15)', forfeited.forfeitedCents === 1500 && forfeited.lotCount === 2, forfeited);
    check('clawback debt survives deletion', (await balance(u9)) === -400);
    const forfeitEntries = await sql<{ total: number; count: number }[]>`
      SELECT COALESCE(SUM(amount_cents), 0)::int AS total, COUNT(*)::int AS count
      FROM public.credit_entries WHERE user_id = ${u9} AND kind = 'forfeiture'`;
    check('forfeiture entries balance the zeroing', forfeitEntries[0]!.total === -1500 && forfeitEntries[0]!.count === 2, forfeitEntries);

    // ---- 10. expiry sweep kills only overdue REMAINDERS ----
    console.log('\n10. expireOverdueLots:');
    const u10 = await newUser('expiry');
    const dying = await grantCredit(sql, { userId: u10, kind: 'promo', amountCents: 2000, expiresAfterDays: 30 });
    const living = await grantCredit(sql, { userId: u10, kind: 'admin_grant', amountCents: 1000, expiresAfterDays: 60 });
    const txX = await newTxn({ userId: u10, consumerPaidCents: 1500, creditsAppliedCents: 1500, status: 'paid', paidAt: true });
    await sql.begin((tx) =>
      redeemCreditsForTransaction(tx, { userId: u10, transactionId: txX, amountCents: 1500, orderTotalCents: 1500 }));
    // dying: 2000 → 500 remaining. Now push it (and a debt lot) past expiry.
    await sql`UPDATE public.credit_lots SET expires_at = now() - interval '1 hour' WHERE id = ${dying.lotId}`;
    const debt10 = await grantCredit(sql, { userId: u10, kind: 'promo', amountCents: 300 });
    await sql`UPDATE public.credit_lots SET remaining_cents = -300, expires_at = now() - interval '1 hour' WHERE id = ${debt10.lotId}`;

    const swept = await expireOverdueLots(sql);
    check('sweep reports at least our lot', swept.expiredLots >= 1 && swept.expiredCents >= 500, swept);
    const lots10 = await sql<{ id: string; remaining_cents: number }[]>`
      SELECT id, remaining_cents FROM public.credit_lots WHERE user_id = ${u10}`;
    const rem10 = (id: string | null) => lots10.find((l) => l.id === id)?.remaining_cents;
    check('overdue remainder zeroed', rem10(dying.lotId) === 0, lots10);
    check('unexpired lot untouched', rem10(living.lotId) === 1000, lots10);
    check('expired DEBT is not "expired" away', rem10(debt10.lotId) === -300, lots10);
    const [expiryEntry] = await sql<{ amount_cents: number }[]>`
      SELECT amount_cents FROM public.credit_entries
      WHERE lot_id = ${dying.lotId} AND kind = 'expiry'`;
    check('expiry entry = the remainder, not the original grant', expiryEntry?.amount_cents === -500, expiryEntry);
    const debtEntries = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM public.credit_entries WHERE lot_id = ${debt10.lotId}`;
    check('no entry written for the debt lot', debtEntries[0]!.count === 0, debtEntries);
  } finally {
    // Hard cleanup — children first. Lots/entries reference users, rules, and
    // transactions; audit rows reference users/claims/transactions; everything
    // transactional hangs off the one test vendor.
    console.log('\nCleaning up test data…');
    await settle(); // let fire-and-forget audits/notifications land first
    const uids = userIds;
    if (uids.length > 0) {
      await sql`DELETE FROM public.credit_entries WHERE user_id = ANY(${sql.array(uids)}::uuid[])`;
      await sql`DELETE FROM public.credit_lots WHERE user_id = ANY(${sql.array(uids)}::uuid[])`;
    }
    if (created.ruleId) {
      // If a REAL signup attributed against the test rule during the run, its
      // lot blocks the DELETE — deactivate instead so cleanup never wedges.
      try {
        await sql`DELETE FROM public.credit_rules WHERE id = ${created.ruleId}`;
      } catch {
        await sql`UPDATE public.credit_rules SET active = false WHERE id = ${created.ruleId}`;
      }
    }
    if (created.vendorId) {
      await sql`
        DELETE FROM public.audit_log
        WHERE vendor_id = ${created.vendorId}
           OR transaction_id IN (SELECT id FROM public.transactions WHERE vendor_id = ${created.vendorId})
           OR claim_id IN (SELECT id FROM public.claims WHERE vendor_id = ${created.vendorId})`;
    }
    if (uids.length > 0) {
      // Credit/referral audits that carry no FK anchor (refusals, plain grants)
      // name the test users in meta — sweep those too.
      await sql`
        DELETE FROM public.audit_log
        WHERE actor_user_id = ANY(${sql.array(uids)}::uuid[])
           OR meta->>'userId' = ANY(${sql.array(uids)}::text[])
           OR meta->>'refereeId' = ANY(${sql.array(uids)}::text[])`;
    }
    if (created.vendorId) {
      await sql`DELETE FROM public.redemption_attempts WHERE vendor_id = ${created.vendorId}`;
      await sql`DELETE FROM public.claims WHERE vendor_id = ${created.vendorId}`;
      await sql`DELETE FROM public.transactions WHERE vendor_id = ${created.vendorId}`;
      if (created.variantId) await sql`DELETE FROM public.deal_variants WHERE id = ${created.variantId}`;
      if (created.dealId) await sql`DELETE FROM public.deals WHERE id = ${created.dealId}`;
      await sql`DELETE FROM public.vendors WHERE id = ${created.vendorId}`;
    }
    if (uids.length > 0) {
      await sql`UPDATE public.users SET referred_by = NULL WHERE id = ANY(${sql.array(uids)}::uuid[])`;
      await sql`DELETE FROM public.users WHERE id = ANY(${sql.array(uids)}::uuid[])`;
    }
    if (created.deletedEmailHash) {
      await sql`DELETE FROM public.deleted_account_email_hashes WHERE email_hash = ${created.deletedEmailHash}`;
    }
    console.log('Cleaned up.');
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
