import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' });
  const ACCT = 'acct_1TZciSPaVOuerUKV';

  const bal = await s.balance.retrieve(undefined, { stripeAccount: ACCT });
  const sumUsd = (entries: any[]) => entries.filter(e => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);

  console.log(`\nTest Vendor Spa current state:`);
  console.log(`  Available:  $${(sumUsd(bal.available)/100).toFixed(2)}`);
  console.log(`  Pending:    $${(sumUsd(bal.pending)/100).toFixed(2)}`);
  console.log(`  Total held: $${((sumUsd(bal.available) + sumUsd(bal.pending))/100).toFixed(2)}`);

  // Find non-reversed transfers (these are what we'd reverse to claw back money)
  const transfers = await s.transfers.list({ destination: ACCT, limit: 100 });
  let unreversed = [];
  let unreversedTotal = 0;
  for (const t of transfers.data) {
    const reversedAmount = (t.reversals?.data ?? []).reduce((s, r) => s + r.amount, 0);
    const remaining = t.amount - reversedAmount;
    if (remaining > 0) {
      unreversed.push({ id: t.id, amount: t.amount, remaining, created: new Date(t.created * 1000).toISOString() });
      unreversedTotal += remaining;
    }
  }
  console.log(`\nTransfers with money still on Vendor side (not yet reversed):`);
  unreversed.forEach(t => console.log(`  ${t.id}  $${(t.remaining/100).toFixed(2)} of $${(t.amount/100).toFixed(2)}  ${t.created}`));
  console.log(`  TOTAL clawback-able: $${(unreversedTotal/100).toFixed(2)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
