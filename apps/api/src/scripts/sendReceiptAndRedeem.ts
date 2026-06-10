import 'dotenv/config';

import { createElement } from 'react';

import { render } from '@react-email/components';

import { sql } from '../db/client';
import { ReceiptEmail } from '../emails/ReceiptEmail';
import { sendEmail } from '../domain/email';
import { redeemClaimByVendor } from '../domain/claims';

/**
 * One-off for txn 31e13aac (GLOE-NU9HD): send the missed receipt from the
 * local machine (prod skipped it — no RESEND_API_KEY on Railway), then redeem
 * the claim through the real redemption path.
 *   npx tsx src/scripts/sendReceiptAndRedeem.ts
 */
const TXN_ID = '31e13aac-cfcf-4dd4-a30c-1088d448dfa1';
const CLAIM_ID = '9f659026-237a-47a5-9178-5eb2c26434e9';
const VENDOR_ID = '77777777-7777-7777-7777-777777777777';

async function main() {
  const rows = await sql<{
    user_id: string;
    email: string | null;
    first_name: string | null;
    consumer_paid_cents: number;
    human_code: string;
    expires_at: string;
    snapshot: { dealTitle?: string; vendorName?: string; variantLabel?: string };
    deal_id: string;
  }[]>`
    SELECT t.user_id, u.email, u.first_name, t.consumer_paid_cents,
           c.human_code, c.expires_at, c.snapshot, c.deal_id
    FROM public.transactions t
    JOIN public.users u ON u.id = t.user_id
    JOIN public.claims c ON c.transaction_id = t.id
    WHERE t.id = ${TXN_ID}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r?.email) { console.error('No recipient found'); process.exit(1); }

  const photoRows = await sql<{ url: string }[]>`
    SELECT url FROM public.deal_photos WHERE deal_id = ${r.deal_id}
    ORDER BY CASE WHEN photo_type = 'hero' THEN 0 ELSE 1 END, display_order ASC LIMIT 1
  `;
  const html = await render(
    createElement(ReceiptEmail, {
      firstName: r.first_name,
      dealTitle: r.snapshot.dealTitle ?? 'your purchase',
      vendorName: r.snapshot.vendorName ?? 'the spa',
      variantLabel: r.snapshot.variantLabel ?? '',
      quantity: 1,
      amountPaidCents: r.consumer_paid_cents,
      codes: [r.human_code],
      expiresAt: new Date(r.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      photoUrl: photoRows[0]?.url ?? null,
      walletUrl: `${process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app'}/wallet`,
    }),
  );
  const sent = await sendEmail({
    to: r.email,
    subject: `Your ${r.snapshot.dealTitle ?? 'Gloē'} receipt`,
    html,
    idempotencyKey: `receipt:${r.human_code}`,
  });
  console.log(sent.sent ? `✓ receipt sent → ${r.email} (resend id ${sent.id})` : `✗ receipt failed: ${sent.error}`);

  const redeem = await redeemClaimByVendor(sql, VENDOR_ID, r.user_id, CLAIM_ID);
  console.log('redeem →', JSON.stringify(redeem));

  await sql.end();
  process.exit(sent.sent && redeem.redeemed ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
