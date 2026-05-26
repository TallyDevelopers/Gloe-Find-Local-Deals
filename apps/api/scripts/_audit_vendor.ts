import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' });
  const ACCT = 'acct_1TZciSPaVOuerUKV';

  const transfers = await s.transfers.list({ destination: ACCT, limit: 20 });
  console.log(`\nTransfers TO Test Vendor Spa (most recent first):`);
  let totalIn = 0;
  for (const t of transfers.data) {
    console.log(`  ${new Date(t.created * 1000).toISOString()}  $${(t.amount/100).toFixed(2)}  ${t.id}`);
    totalIn += t.amount;
  }
  console.log(`  TOTAL transfers in: $${(totalIn/100).toFixed(2)}`);

  const bal = await s.balance.retrieve({ stripeAccount: ACCT });
  console.log(`\nCurrent balance:`);
  console.log(`  Available: ${bal.available.map(b => `$${(b.amount/100).toFixed(2)} ${b.currency}`).join(', ')}`);
  console.log(`  Pending:   ${bal.pending.map(b => `$${(b.amount/100).toFixed(2)} ${b.currency}`).join(', ')}`);
}
main().catch(e => { console.error(e); process.exit(1); });
