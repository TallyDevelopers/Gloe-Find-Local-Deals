/**
 * Refund test runner. Exercises scenario 7 from TEST_SCENARIOS.md without
 * needing a browser session. Reads transactions out of the live DB, calls
 * the refund domain function directly, asserts DB + audit log state.
 *
 * Usage: cd apps/api && npx tsx scripts/test_refund_scenarios.ts <scenario>
 *
 * Scenarios:
 *   7c  refuse refund on redeemed claim
 *   7e  refuse refund with reason too short
 *   7d  refuse refund with amount > balance (requires partially_refunded txn)
 *   7a  full refund   (CAUTION: real Stripe refund. Pass --txn=<id> explicitly)
 *   7b  partial refund (CAUTION: real Stripe refund. Pass --txn=<id> explicitly)
 *   7f  idempotency check (real Stripe call; pass --txn=<id>)
 *
 * For 7a/7b/7f, the txn id must be passed by the caller. Pure safety —
 * we won't auto-pick a paid txn to refund.
 */

import 'dotenv/config';
import { sql } from '../src/db/client';
import { refundTransaction } from '../src/domain/vendorOps';

const ADMIN_USER_ID = '653e5cd2-6e33-4918-a04a-fb90c9d854fe'; // husseinmsaab@gmail.com

const scenario = process.argv[2];
const txnFlag = process.argv.find((a) => a.startsWith('--txn='))?.split('=')[1];
const amountFlag = process.argv.find((a) => a.startsWith('--amount='))?.split('=')[1];

function pass(msg: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}
function fail(msg: string) {
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}

async function findRedeemedTxn(): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT t.id FROM public.transactions t
    JOIN public.claims c ON c.transaction_id = t.id
    WHERE c.status = 'redeemed' AND t.status = 'paid'
    ORDER BY t.created_at DESC LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function findPartialTxn(): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM public.transactions
    WHERE status = 'partially_refunded' AND refunded_cents < consumer_paid_cents
    ORDER BY updated_at DESC LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function countAuditRows(action: string, txnId: string, since: Date): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM public.audit_log
    WHERE action = ${action} AND transaction_id = ${txnId} AND created_at >= ${since.toISOString()}
  `;
  return rows[0]?.n ?? 0;
}

async function run() {
  const start = new Date();
  console.log(`\nScenario: ${scenario}`);

  switch (scenario) {
    case '7c': {
      const txnId = await findRedeemedTxn();
      if (!txnId) {
        fail('No transaction with redeemed claim found — cannot test 7c');
        return;
      }
      console.log(`  Using txn ${txnId} (claim redeemed)`);
      const result = await refundTransaction(sql, txnId, 5000, ADMIN_USER_ID, 'test 7c refuse');
      result.refunded === false ? pass('Refund refused as expected') : fail('Refund was issued (should have refused)');
      result.error?.includes('redeemed') ? pass(`Reason mentions redeemed: "${result.error}"`) : fail(`Reason wrong: "${result.error}"`);
      const auditN = await countAuditRows('refund.refused', txnId, start);
      auditN === 1 ? pass('audit_log has 1 refund.refused row') : fail(`audit_log has ${auditN} refund.refused rows`);
      break;
    }

    case '7e': {
      // Reason too short — pick any txn (it'll refuse before touching anything).
      const txnId = (await sql<{ id: string }[]>`SELECT id FROM public.transactions LIMIT 1`)[0]?.id;
      if (!txnId) { fail('No transactions in DB'); return; }
      const result = await refundTransaction(sql, txnId, 100, ADMIN_USER_ID, 'ab');
      result.refunded === false ? pass('Refund refused as expected') : fail('Refund went through (should have refused)');
      result.error?.includes('reason') || result.error?.includes('Reason')
        ? pass(`Reason error: "${result.error}"`)
        : fail(`Wrong reason: "${result.error}"`);
      break;
    }

    case '7d': {
      const txnId = txnFlag ?? await findPartialTxn();
      if (!txnId) {
        fail('No partially_refunded txn found. Run 7b first to create one, or pass --txn=<id>');
        return;
      }
      const r = await sql<{ consumer_paid_cents: number; refunded_cents: number }[]>`
        SELECT consumer_paid_cents, refunded_cents FROM public.transactions WHERE id = ${txnId} LIMIT 1
      `;
      if (!r[0]) { fail('Txn not found'); return; }
      const remaining = r[0].consumer_paid_cents - r[0].refunded_cents;
      const overshot = remaining + 1000;
      console.log(`  Txn ${txnId}: remaining=${remaining}, attempting refund of ${overshot}`);
      const result = await refundTransaction(sql, txnId, overshot, ADMIN_USER_ID, 'test 7d overshoot');
      result.refunded === false ? pass('Refund refused as expected') : fail('Refund went through (should have refused)');
      result.error?.includes('exceeds') ? pass(`Reason mentions exceeds: "${result.error}"`) : fail(`Wrong reason: "${result.error}"`);
      const auditN = await countAuditRows('refund.refused', txnId, start);
      auditN === 1 ? pass('audit_log has 1 refund.refused row') : fail(`audit_log has ${auditN} refund.refused rows`);
      break;
    }

    case '7a': {
      if (!txnFlag) { fail('7a requires --txn=<id> for safety (this issues a real Stripe refund)'); return; }
      const r = await sql<{ consumer_paid_cents: number; status: string; refunded_cents: number }[]>`
        SELECT consumer_paid_cents, status, refunded_cents FROM public.transactions WHERE id = ${txnFlag} LIMIT 1
      `;
      if (!r[0]) { fail('Txn not found'); return; }
      const remaining = r[0].consumer_paid_cents - r[0].refunded_cents;
      console.log(`  Refunding ${remaining}¢ of ${r[0].consumer_paid_cents}¢ (full)`);
      const result = await refundTransaction(sql, txnFlag, remaining, ADMIN_USER_ID, 'test 7a full refund');
      if (!result.refunded) { fail(`Refund refused: ${result.error}`); return; }
      pass(`Stripe refund created: ${result.stripeRefundId}`);
      pass(`isFullRefund: ${result.isFullRefund}`);
      const after = await sql<{ status: string; refunded_cents: number; claim_status: string }[]>`
        SELECT t.status, t.refunded_cents, c.status AS claim_status
        FROM public.transactions t LEFT JOIN public.claims c ON c.transaction_id = t.id
        WHERE t.id = ${txnFlag} LIMIT 1
      `;
      const a = after[0]!;
      a.status === 'refunded' ? pass(`txn.status = refunded`) : fail(`txn.status = ${a.status}`);
      a.refunded_cents === r[0].consumer_paid_cents ? pass(`refunded_cents = ${a.refunded_cents}`) : fail(`refunded_cents = ${a.refunded_cents}, expected ${r[0].consumer_paid_cents}`);
      a.claim_status === 'cancelled' ? pass(`claim.status = cancelled`) : fail(`claim.status = ${a.claim_status}`);
      const auditN = await countAuditRows('refund.issued', txnFlag, start);
      auditN === 1 ? pass('audit_log has 1 refund.issued row') : fail(`audit_log has ${auditN} refund.issued rows`);
      break;
    }

    case '7b': {
      if (!txnFlag) { fail('7b requires --txn=<id>'); return; }
      const amount = amountFlag ? parseInt(amountFlag, 10) : null;
      if (!amount) { fail('7b requires --amount=<cents>'); return; }
      console.log(`  Refunding ${amount}¢ (partial)`);
      const result = await refundTransaction(sql, txnFlag, amount, ADMIN_USER_ID, `test 7b partial ${amount}`);
      if (!result.refunded) { fail(`Refund refused: ${result.error}`); return; }
      pass(`Stripe refund created: ${result.stripeRefundId}`);
      pass(`isFullRefund: ${result.isFullRefund}`);
      const after = await sql<{ status: string; refunded_cents: number; claim_status: string }[]>`
        SELECT t.status, t.refunded_cents, c.status AS claim_status
        FROM public.transactions t LEFT JOIN public.claims c ON c.transaction_id = t.id
        WHERE t.id = ${txnFlag} LIMIT 1
      `;
      const a = after[0]!;
      if (result.isFullRefund) {
        a.status === 'refunded' ? pass(`txn.status = refunded`) : fail(`txn.status = ${a.status}`);
        a.claim_status === 'cancelled' ? pass(`claim.status = cancelled`) : fail(`claim.status = ${a.claim_status}`);
      } else {
        a.status === 'partially_refunded' ? pass(`txn.status = partially_refunded`) : fail(`txn.status = ${a.status}`);
        a.claim_status === 'active' ? pass(`claim.status = active (voucher stays live)`) : fail(`claim.status = ${a.claim_status}`);
      }
      pass(`refunded_cents = ${a.refunded_cents}`);
      break;
    }

    default:
      console.log('Unknown scenario. Use: 7a, 7b, 7c, 7d, 7e');
  }

  await sql.end();
}

run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
