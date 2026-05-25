import 'dotenv/config';
import Stripe from 'stripe';

async function main() {
  const s = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' });

  // Pull every balance_transaction (BT) — these are the ledger entries that
  // sum to your current balance. Source of truth for "where did this number come from."
  console.log(`\n══════════ BALANCE TRANSACTIONS (most recent first) ══════════`);
  const bts = await s.balanceTransactions.list({ limit: 100 });

  let runningAvailable = 0;
  let runningPending = 0;
  // We need to walk OLDEST → NEWEST to build a running total. Reverse.
  const ordered = [...bts.data].reverse();

  console.log(`  ${'TIME'.padEnd(25)} ${'TYPE'.padEnd(22)} ${'GROSS'.padStart(10)} ${'FEE'.padStart(8)} ${'NET'.padStart(10)} ${'STATUS'.padEnd(10)}  DESCRIPTION`);
  console.log(`  ${'-'.repeat(120)}`);
  for (const bt of ordered) {
    const time = new Date(bt.created * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const gross = (bt.amount / 100).toFixed(2);
    const fee = (bt.fee / 100).toFixed(2);
    const net = (bt.net / 100).toFixed(2);
    const status = bt.status; // available | pending
    const desc = bt.description ?? bt.type;
    console.log(`  ${time.padEnd(25)} ${bt.type.padEnd(22)} ${gross.padStart(10)} ${fee.padStart(8)} ${net.padStart(10)} ${status.padEnd(10)}  ${desc}`);
    if (status === 'available') runningAvailable += bt.net;
    else if (status === 'pending') runningPending += bt.net;
  }

  console.log(`\n══════════ COMPUTED FROM LEDGER ══════════`);
  console.log(`  Available (sum of net where status=available):  $${(runningAvailable/100).toFixed(2)}`);
  console.log(`  Pending   (sum of net where status=pending):    $${(runningPending/100).toFixed(2)}`);
  console.log(`  TOTAL on platform balance:                       $${((runningAvailable+runningPending)/100).toFixed(2)}`);

  console.log(`\n══════════ LIVE BALANCE FROM STRIPE ══════════`);
  const bal = await s.balance.retrieve();
  const sumUsd = (entries: any[]) => entries.filter(e => e.currency === 'usd').reduce((s, e) => s + e.amount, 0);
  console.log(`  Available: $${(sumUsd(bal.available)/100).toFixed(2)}`);
  console.log(`  Pending:   $${(sumUsd(bal.pending)/100).toFixed(2)}`);
  if (bal.instant_available) console.log(`  Instant available: $${(sumUsd(bal.instant_available)/100).toFixed(2)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
