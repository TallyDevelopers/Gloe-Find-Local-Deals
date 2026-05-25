import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' });
  const ACCT = 'acct_1TZciSPaVOuerUKV';

  const transfers = await s.transfers.list({ destination: ACCT, limit: 100 });
  let total = 0, count = 0;

  for (const t of transfers.data) {
    const reversedAmount = (t.reversals?.data ?? []).reduce((s, r) => s + r.amount, 0);
    const remaining = t.amount - reversedAmount;
    if (remaining <= 0) continue;
    try {
      const r = await s.transfers.createReversal(t.id, { amount: remaining });
      console.log(`  ✓ ${t.id} → reversed $${(remaining/100).toFixed(2)}  (reversal ${r.id})`);
      total += remaining;
      count++;
    } catch (e) {
      console.log(`  ✗ ${t.id} → FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\nReversed ${count} transfer(s), $${(total/100).toFixed(2)} total`);

  const bal = await s.balance.retrieve(undefined, { stripeAccount: ACCT });
  const sumUsd = (entries: any[]) => entries.filter(e => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);
  console.log(`\nTest Vendor Spa balance now:`);
  console.log(`  Available: $${(sumUsd(bal.available)/100).toFixed(2)}`);
  console.log(`  Pending:   $${(sumUsd(bal.pending)/100).toFixed(2)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
