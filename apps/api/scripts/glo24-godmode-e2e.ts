/**
 * GLO-24 god-mode delivery-readiness test — runs the REAL credit admin code
 * against the dev DB. Focus: every failure path must surface a HUMAN error
 * message (no zod JSON dumps, no raw DB errors), and the grant/revoke/ledger
 * money math must hold.
 *
 * Safe by construction: throwaway user with NULL email (no real emails fire),
 * campaigns are only drafted/deleted — never sent. Everything is cleaned up.
 *
 * Run: npx tsx scripts/glo24-godmode-e2e.ts
 */
import 'dotenv/config';

import { sql } from '../src/db/client';
import {
  CreditRuleConflictError,
  adminGrantCredit,
  createCreditCampaign,
  createCreditRule,
  deactivateCreditRule,
  deleteDraftCampaign,
  getCreditLedgerForUser,
  getCreditProgramStats,
  listCreditCampaigns,
  listCustomerCities,
  previewCampaignAudience,
  reactivateCreditRule,
  revokeCreditLot,
  sendCreditCampaign,
  updateCreditRule,
} from '../src/domain/creditAdmin';
import { computeApplicableCredits, freezeCreditLedger, grantCredit, unfreezeCreditLedger } from '../src/domain/credits';
import { recordUserLocation } from '../src/domain/userLocation';
import { creditCampaignInput, creditRuleInput, grantCreditInput, revokeCreditLotInput } from '../src/router/admin.router';
import { friendlyZodMessage } from '../src/router/trpc';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

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
/** A message is "human" when it isn't a zod JSON dump or a raw postgres error. */
function isHuman(msg: string): boolean {
  return !msg.trimStart().startsWith('[') && !/violates|constraint|syntax|relation "/.test(msg);
}
function wireError(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, value: unknown): string {
  const r = schema.safeParse(value);
  if (r.success) return '(parsed OK — expected failure)';
  return friendlyZodMessage(r.error as never);
}

/** Test tiers live at ≥ $900k order minimums — nothing real is up there. */
const TEST_TIER_FLOOR = 90_000_000;

async function main() {
  const ruleIds: string[] = [];
  let userId: string | null = null;
  let campaignId: string | null = null;

  // Self-heal: a crashed earlier run may have left test rows behind.
  await sql`DELETE FROM public.credit_rules WHERE rule_type = 'purchase_tier' AND min_purchase_cents >= ${TEST_TIER_FLOOR}`;

  try {
    /* ── A. Wire-level messages: zod + the new errorFormatter ─────────────── */
    console.log('\nA. Wire-level error messages (what the console actually shows)');

    const grantBase = { userId: NIL_UUID, amountCents: 1234, expiresAfterDays: 30, note: 'service recovery' };
    let m = wireError(grantCreditInput, { ...grantBase, note: '' });
    check('empty note → friendly "add a note" message', m.includes('Add a note'), `(got: ${m})`);
    m = wireError(grantCreditInput, { ...grantBase, note: '   ' });
    check('whitespace-only note → same message', m.includes('Add a note'), `(got: ${m})`);
    m = wireError(grantCreditInput, { ...grantBase, amountCents: 0 });
    check('zero amount → friendly amount message', m.includes('greater than $0'), `(got: ${m})`);
    m = wireError(grantCreditInput, { ...grantBase, amountCents: NaN });
    check('NaN amount → "valid number" message', isHuman(m) && m.toLowerCase().includes('number'), `(got: ${m})`);
    m = wireError(grantCreditInput, { ...grantBase, amountCents: 60_000 });
    check('over-cap amount → "$500 cap" message', m.includes('capped at $500'), `(got: ${m})`);
    m = wireError(grantCreditInput, { ...grantBase, expiresAfterDays: 0 });
    check('zero expiry → friendly expiry message', m.includes('at least 1 day'), `(got: ${m})`);

    m = wireError(revokeCreditLotInput, { lotId: NIL_UUID, reason: '' });
    check('empty revoke reason → friendly message', m.includes('Give a reason'), `(got: ${m})`);

    const campBase = { name: 'Test', amountCents: 500, expiresAfterDays: 30, audience: 'everyone', messageTitle: 'Hi', messageBody: 'Body' };
    m = wireError(creditCampaignInput, { ...campBase, name: '' });
    check('campaign w/o name → friendly message', m.includes('internal name'), `(got: ${m})`);
    m = wireError(creditCampaignInput, { ...campBase, amountCents: 0 });
    check('campaign w/o amount → friendly message', m.includes('credit amount per customer'), `(got: ${m})`);
    m = wireError(creditCampaignInput, { ...campBase, messageTitle: '' });
    check('campaign w/o title → friendly message', m.includes('title customers will see'), `(got: ${m})`);
    m = wireError(creditCampaignInput, { ...campBase, messageBody: '' });
    check('campaign w/o body → friendly message', m.includes('message body'), `(got: ${m})`);

    m = wireError(creditRuleInput, { ruleType: 'purchase_tier', expiresAfterDays: 0 });
    check('rule w/ zero expiry → friendly message', m.includes('at least 1 day'), `(got: ${m})`);
    m = wireError(creditRuleInput, { ruleType: 'purchase_tier', expiresAfterDays: 90, percentBps: 20_000 });
    check('rule w/ >100% → friendly message', m.includes('cannot exceed 100%'), `(got: ${m})`);

    /* ── B. Domain validation messages ────────────────────────────────────── */
    console.log('\nB. Domain validation (rule shapes)');

    await expectThrow('tier without a minimum', () =>
      createCreditRule(sql, { ruleType: 'purchase_tier', creditCents: 1000, expiresAfterDays: 90, active: false }),
      'minimum purchase amount');
    await expectThrow('tier max ≤ min', () =>
      createCreditRule(sql, { ruleType: 'purchase_tier', minPurchaseCents: 10_000, maxPurchaseCents: 5_000, creditCents: 1000, expiresAfterDays: 90, active: false }),
      'greater than min');
    await expectThrow('tier with flat AND percent', () =>
      createCreditRule(sql, { ruleType: 'purchase_tier', minPurchaseCents: 0, creditCents: 1000, percentBps: 500, expiresAfterDays: 90, active: false }),
      'not both');
    await expectThrow('tier with neither reward', () =>
      createCreditRule(sql, { ruleType: 'purchase_tier', minPurchaseCents: 0, expiresAfterDays: 90, active: false }),
      'not both, not neither');
    await expectThrow('referral missing get amount', () =>
      createCreditRule(sql, { ruleType: 'referral', giveCents: 2000, expiresAfterDays: 90, active: false }),
      'both a give amount');
    await expectThrow('signup bonus missing credit', () =>
      createCreditRule(sql, { ruleType: 'signup_bonus', expiresAfterDays: 90, active: false }),
      'needs a credit amount');
    await expectThrow('update unknown rule → not found', () =>
      updateCreditRule(sql, NIL_UUID, { ruleType: 'signup_bonus', creditCents: 500, expiresAfterDays: 90 }),
      'Rule not found');
    await expectThrow('deactivate unknown rule → not found', () =>
      deactivateCreditRule(sql, NIL_UUID), 'Rule not found');
    await expectThrow('reactivate unknown rule → not found', () =>
      reactivateCreditRule(sql, NIL_UUID), 'Rule not found');

    /* ── C. Rule conflicts (active-rule walls) ────────────────────────────── */
    console.log('\nC. Rule conflict walls');

    // Tier range far above anything real (~$900k orders) so the dev DB can't collide.
    const HI = TEST_TIER_FLOOR;
    const tierA = await createCreditRule(sql, {
      ruleType: 'purchase_tier', minPurchaseCents: HI, maxPurchaseCents: HI + 100_000,
      creditCents: 1000, expiresAfterDays: 90, active: true,
    });
    ruleIds.push(tierA.id);
    check('non-overlapping tier creates fine', tierA.active);

    await expectThrow('overlapping active tier refused', () =>
      createCreditRule(sql, {
        ruleType: 'purchase_tier', minPurchaseCents: HI + 50_000, maxPurchaseCents: HI + 150_000,
        creditCents: 500, expiresAfterDays: 90, active: true,
      }), 'overlaps');

    const tierC = await createCreditRule(sql, {
      ruleType: 'purchase_tier', minPurchaseCents: HI + 100_000, maxPurchaseCents: HI + 200_000,
      creditCents: 500, expiresAfterDays: 90, active: true,
    });
    ruleIds.push(tierC.id);
    check('adjacent (touching) tier is NOT a conflict', tierC.active);

    await expectThrow('changing a rule’s type refused', () =>
      updateCreditRule(sql, tierA.id, { ruleType: 'signup_bonus', creditCents: 500, expiresAfterDays: 90 }),
      'Cannot change');

    await deactivateCreditRule(sql, tierA.id);
    await reactivateCreditRule(sql, tierA.id);
    check('deactivate → reactivate round-trip works', true);

    // Referral singleton: either the live rule blocks ours, or ours blocks a second.
    try {
      const ref1 = await createCreditRule(sql, { ruleType: 'referral', giveCents: 1, getCents: 1, expiresAfterDays: 90, active: true });
      ruleIds.push(ref1.id);
      await expectThrow('second active referral rule refused', () =>
        createCreditRule(sql, { ruleType: 'referral', giveCents: 2, getCents: 2, expiresAfterDays: 90, active: true }),
        'Only one referral');
    } catch (e) {
      check('live referral rule already active → singleton wall held',
        e instanceof CreditRuleConflictError && e.message.includes('Only one referral'), `(got: ${(e as Error).message})`);
    }

    /* ── D. Manual grant / revoke + ledger math ───────────────────────────── */
    console.log('\nD. Manual grant / revoke / ledger');

    await expectThrow('grant to unknown customer', () =>
      adminGrantCredit(sql, { userId: NIL_UUID, amountCents: 1000, expiresAfterDays: 30, note: 'test', actorUserId: NIL_UUID }),
      'Customer not found');
    await expectThrow('one-door grant rejects 0¢', () =>
      grantCredit(sql, { userId: NIL_UUID, kind: 'admin_grant', amountCents: 0 }),
      'positive integer');
    await expectThrow('one-door grant rejects fractional cents', () =>
      grantCredit(sql, { userId: NIL_UUID, kind: 'admin_grant', amountCents: 12.5 }),
      'positive integer');

    // NULL email on purpose: sendCreditGrantedEmail returns early, no real email.
    const userRows = await sql<{ id: string }[]>`
      INSERT INTO public.users (clerk_user_id, email, first_name, last_name)
      VALUES ('e2e_glo24_' || gen_random_uuid(), NULL, 'GodMode', 'Tester')
      RETURNING id
    `;
    userId = userRows[0]!.id;

    const g1 = await adminGrantCredit(sql, { userId, amountCents: 1234, expiresAfterDays: 30, note: 'sorry about the mix-up', actorUserId: userId });
    check('grant #1 returns a lot id + expiry', !!g1.lotId && !!g1.expiresAt);

    const g2 = await adminGrantCredit(sql, { userId, amountCents: 1234, expiresAfterDays: null, note: 'second one, never expires', actorUserId: userId });
    check('grant #2 (no expiry) returns null expiresAt', !!g2.lotId && g2.expiresAt === null);

    let ledger = await getCreditLedgerForUser(sql, userId);
    check('ledger balance = $24.68 after two grants', ledger?.balanceCents === 2468, `(got: ${ledger?.balanceCents})`);
    check('ledger available = $24.68', ledger?.availableCents === 2468, `(got: ${ledger?.availableCents})`);
    check('lot note survives to the ledger', ledger?.lots.some((l) => l.note === 'sorry about the mix-up') ?? false);

    const rev = await revokeCreditLot(sql, { lotId: g1.lotId!, reason: 'granted in error', actorUserId: userId });
    check('revoke returns the clawed amount', rev.revokedCents === 1234, `(got: ${rev.revokedCents})`);
    ledger = await getCreditLedgerForUser(sql, userId);
    check('ledger drops to $12.34 after revoke', ledger?.availableCents === 1234, `(got: ${ledger?.availableCents})`);
    check('clawback entry carries the reason', ledger?.entries.some((e) => e.kind === 'clawback' && e.meta.reason === 'granted in error') ?? false);

    await expectThrow('double-revoke refused', () =>
      revokeCreditLot(sql, { lotId: g1.lotId!, reason: 'again', actorUserId: userId! }),
      'Nothing left');
    await expectThrow('revoke unknown lot', () =>
      revokeCreditLot(sql, { lotId: NIL_UUID, reason: 'nope', actorUserId: userId! }),
      'Lot not found');

    await freezeCreditLedger(sql, userId);
    const frozenApply = await computeApplicableCredits(sql, { userId, orderTotalCents: 10_000 });
    check('frozen ledger applies $0 at checkout', frozenApply === 0, `(got: ${frozenApply})`);
    ledger = await getCreditLedgerForUser(sql, userId);
    check('ledger shows the freeze', !!ledger?.user.creditFrozenAt);
    await unfreezeCreditLedger(sql, userId);
    const thawedApply = await computeApplicableCredits(sql, { userId, orderTotalCents: 10_000 });
    check('thawed ledger applies credit again', thawedApply === 1234, `(got: ${thawedApply})`);

    /* ── E. Campaigns (draft lifecycle only — NEVER sent) ─────────────────── */
    console.log('\nE. Campaign draft lifecycle');

    const camp = await createCreditCampaign(sql, {
      name: 'GLO-24 e2e draft (delete me)', amountCents: 100, expiresAfterDays: 30,
      audience: 'everyone', messageTitle: 'Test', messageBody: 'Never sent.',
    }, userId);
    campaignId = camp.id;
    const camps = await listCreditCampaigns(sql);
    check('draft shows in the list as draft', camps.some((c) => c.id === camp.id && c.status === 'draft'));

    const preview = await previewCampaignAudience(sql, 'everyone');
    check('audience preview returns a count', Number.isFinite(preview.userCount) && preview.userCount >= 1, `(got: ${preview.userCount})`);

    await expectThrow('send unknown campaign → friendly', () =>
      sendCreditCampaign(sql, NIL_UUID, userId!), 'not found or already sent');

    await deleteDraftCampaign(sql, camp.id);
    campaignId = null;
    await expectThrow('double-delete draft → friendly', () =>
      deleteDraftCampaign(sql, camp.id), 'not found or already sent');

    /* ── F. Program stats sanity ──────────────────────────────────────────── */
    console.log('\nF. Program dashboard');
    const stats = await getCreditProgramStats(sql);
    check('stats numbers are all finite', Object.entries(stats).every(([k, v]) => k === 'byKind' || Number.isFinite(v as number)));
    check('outstanding liability ≥ 0', stats.outstandingLiabilityCents >= 0);

    /* ── G. Location capture + city-targeted campaigns ────────────────────── */
    console.log('\nG. Location capture + city targeting');

    const CITY = 'Testopolis, ZZ';
    // Seed a known city with a NULL timestamp: the first capture updates the
    // coords (stale) but keeps the city (move < 10km → no live geocode call).
    await sql`
      UPDATE public.users
      SET last_lat = 32.715, last_lng = -117.161, last_city = ${CITY}, last_location_at = NULL
      WHERE id = ${userId}
    `;
    await recordUserLocation(sql, userId, 32.7157123, -117.1610789);
    const readLoc = async () => (await sql<{
      last_lat: number | null; last_lng: number | null; last_city: string | null; last_location_at: string | null;
    }[]>`
      SELECT last_lat, last_lng, last_city, last_location_at FROM public.users WHERE id = ${userId}
    `)[0]!;
    let loc = await readLoc();
    check('coords stored rounded to ~3 decimals (city-block)', loc.last_lat === 32.716 && loc.last_lng === -117.161, `(got: ${loc.last_lat}, ${loc.last_lng})`);
    check('city label kept on a small move (no re-geocode)', loc.last_city === CITY, `(got: ${loc.last_city})`);
    check('location timestamp set', !!loc.last_location_at);

    await recordUserLocation(sql, userId, 40, -100);
    loc = await readLoc();
    check('second write inside 15 min is throttled', loc.last_lat === 32.716, `(got: ${loc.last_lat})`);

    const cities = await listCustomerCities(sql);
    check('city directory lists the test city w/ headcount', cities.some((c) => c.city === CITY && c.userCount >= 1));

    const inCity = await previewCampaignAudience(sql, 'everyone', CITY);
    check('city-filtered audience finds the customer', inCity.userCount === 1, `(got: ${inCity.userCount})`);
    const ghost = await previewCampaignAudience(sql, 'everyone', 'Nowhereville, XX');
    check('unknown city audience is 0', ghost.userCount === 0, `(got: ${ghost.userCount})`);

    // A draft aimed at a 0-customer city must refuse to send AND stay a draft.
    const ghostCamp = await createCreditCampaign(sql, {
      name: 'GLO-24 e2e ghost-city (delete me)', amountCents: 100, expiresAfterDays: 30,
      audience: 'everyone', audienceCity: 'Nowhereville, XX', messageTitle: 'Test', messageBody: 'Never sent.',
    }, userId);
    campaignId = ghostCamp.id;
    await expectThrow('0-customer city send refused with a friendly message', () =>
      sendCreditCampaign(sql, ghostCamp.id, userId!), 'nothing to send');
    const stillDraft = await sql<{ status: string }[]>`
      SELECT status FROM public.credit_campaigns WHERE id = ${ghostCamp.id}
    `;
    check('refused send leaves the draft intact', stillDraft[0]?.status === 'draft', `(got: ${stillDraft[0]?.status})`);
    const listedGhost = (await listCreditCampaigns(sql)).find((c) => c.id === ghostCamp.id);
    check('campaign list carries the city', listedGhost?.audienceCity === 'Nowhereville, XX', `(got: ${listedGhost?.audienceCity})`);
    await deleteDraftCampaign(sql, ghostCamp.id);
    campaignId = null;
  } finally {
    /* ── Cleanup ──────────────────────────────────────────────────────────── */
    console.log('\nCleanup…');
    await new Promise((r) => setTimeout(r, 750)); // let fire-and-forget audits/notifies land
    const tidy = async (label: string, fn: () => Promise<unknown>) => {
      try { await fn(); } catch (e) { console.error(`  cleanup "${label}" failed:`, (e as Error).message); }
    };
    if (userId) {
      const uid = userId;
      await tidy('notification queue', () => sql`DELETE FROM public.notification_queue WHERE user_id = ${uid}`);
      await tidy('credit entries', () => sql`DELETE FROM public.credit_entries WHERE user_id = ${uid}`);
      await tidy('credit lots', () => sql`DELETE FROM public.credit_lots WHERE user_id = ${uid}`);
      if (campaignId) {
        const cid = campaignId;
        await tidy('campaign draft', () => sql`DELETE FROM public.credit_campaigns WHERE id = ${cid}`);
      }
      // This run's audit rows name the throwaway user as actor (FK) — drop them first.
      await tidy('audit rows', () => sql`DELETE FROM public.audit_log WHERE actor_user_id = ${uid}`);
      await tidy('test user', () => sql`DELETE FROM public.users WHERE id = ${uid}`);
    }
    for (const id of ruleIds) {
      await tidy('test rule', () => sql`DELETE FROM public.credit_rules WHERE id = ${id}`);
    }
    await sql.end();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main().catch((e) => { console.error(e); process.exit(1); });
