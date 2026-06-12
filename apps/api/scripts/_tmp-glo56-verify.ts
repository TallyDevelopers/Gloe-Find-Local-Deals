import 'dotenv/config';
import { sql } from '../src/db/client';
import { getAdminCustomerDetail, listAdminTransactions } from '../src/domain/admin';
import { freezeCreditLedger, unfreezeCreditLedger } from '../src/domain/credits';
import { sendNotification } from '../src/domain/notifications';

async function main() {
  const u = (await sql<{ id: string; email: string }[]>`
    SELECT u.id, u.email FROM public.users u
    WHERE EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id = u.id AND t.status IN ('paid','released','partially_refunded','refunded'))
    ORDER BY (SELECT COUNT(*) FROM public.transactions t WHERE t.user_id = u.id) DESC LIMIT 1
  `)[0]!;
  console.log('customer under test:', u.email);

  const d = (await getAdminCustomerDetail(sql, u.id))!;
  console.log('✓ detail loads:',
    `txns=${d.transactions.length}`, `vouchers=${d.vouchers.length}`,
    `balance=${d.referral.creditBalanceCents}¢`, `frozen=${d.customer.creditFrozen}`,
    `referralCode=${d.customer.referralCode}`);
  const t0 = d.transactions[0];
  console.log('✓ txn split fields:', t0 ? `paid=${t0.consumerPaidCents} credits=${t0.creditsAppliedCents} promo=${t0.promoDiscountCents}` : 'n/a');
  const v0 = d.vouchers[0];
  console.log('✓ voucher fields:', v0 ? `${v0.humanCode} ${v0.status} "${v0.dealTitle}"` : 'n/a');

  const push = await sendNotification(sql, 'admin_message', u.id, { vars: { title: 'Test from god mode', body: 'GLO-56 verify — ignore.' } });
  console.log('✓ admin_message push path:', JSON.stringify(push));

  const froze = await freezeCreditLedger(sql, u.id);
  const frozenNow = (await getAdminCustomerDetail(sql, u.id))!.customer.creditFrozen;
  const thawed = await unfreezeCreditLedger(sql, u.id);
  console.log('✓ freeze/unfreeze:', { froze, frozenNow, thawed });

  const feed = await listAdminTransactions(sql, { limit: 5 });
  console.log('✓ transactions feed row 0:', feed[0] ? `${feed[0].customerName} | ${feed[0].dealTitle} | ${feed[0].vendorName} | promo=${feed[0].promoDiscountCents} credits=${feed[0].creditsAppliedCents}` : 'empty');

  await sql.end();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
