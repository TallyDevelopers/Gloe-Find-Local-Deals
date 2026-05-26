import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' });

  let charges = await s.charges.list({ limit: 100 });
  let chargeCount = charges.data.length;
  let succeededTotal = 0;
  let refundedTotal = 0;
  for (const ch of charges.data) {
    if (ch.refunded) refundedTotal += ch.amount;
    else if (ch.status === 'succeeded') succeededTotal += ch.amount;
  }

  const pis = await s.paymentIntents.list({ limit: 100 });
  const pendingPi = pis.data.filter(p => p.status === 'requires_payment_method' || p.status === 'requires_confirmation' || p.status === 'processing').length;

  const transfers = await s.transfers.list({ limit: 100 });
  const transferTotal = transfers.data.reduce((s, t) => s + t.amount, 0);

  const balance = await s.balance.retrieve();
  const sumUsd = (entries: any[]) => entries.filter(e => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);

  console.log(`\nStripe TEST inventory:`);
  console.log(`  Charges:    ${chargeCount} (succeeded not yet refunded: $${(succeededTotal/100).toFixed(2)}, already refunded: $${(refundedTotal/100).toFixed(2)})`);
  console.log(`  PIs to cancel: ${pendingPi}`);
  console.log(`  Transfers fired (lifetime): ${transfers.data.length} totaling $${(transferTotal/100).toFixed(2)}`);
  console.log(`  Platform balance: available $${(sumUsd(balance.available)/100).toFixed(2)}, pending $${(sumUsd(balance.pending)/100).toFixed(2)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
