import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' });

  const accounts = await s.accounts.list({ limit: 100 });
  console.log(`\nFound ${accounts.data.length} connected account(s):`);

  for (const acct of accounts.data) {
    try {
      // Newer Stripe SDK puts stripeAccount in the RequestOptions arg
      const bal = await s.balance.retrieve(undefined, { stripeAccount: acct.id });
      const sumUsd = (entries: any[]) => entries.filter(e => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);
      const transfers = await s.transfers.list({ destination: acct.id, limit: 100 });
      const transferIn = transfers.data.reduce((s, t) => s + t.amount, 0);
      const reversals = transfers.data.flatMap(t => (t.reversals?.data ?? []));
      const reversedTotal = reversals.reduce((s, r) => s + r.amount, 0);

      console.log(`\n  ${acct.id}  (${acct.business_profile?.name ?? acct.email ?? 'no name'})`);
      console.log(`    Available:        $${(sumUsd(bal.available)/100).toFixed(2)}`);
      console.log(`    Pending:          $${(sumUsd(bal.pending)/100).toFixed(2)}`);
      console.log(`    Lifetime in:      $${(transferIn/100).toFixed(2)}  (${transfers.data.length} transfers)`);
      console.log(`    Already reversed: $${(reversedTotal/100).toFixed(2)}`);
    } catch (e) {
      console.log(`  ${acct.id}  ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
