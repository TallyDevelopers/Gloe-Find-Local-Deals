import 'dotenv/config';

import { createElement } from 'react';

import { render } from '@react-email/components';

import { ReceiptEmail } from '../emails/ReceiptEmail';
import { sendEmail, isEmailConfigured } from '../domain/email';

/**
 * Renders the receipt email and sends it to the address you pass as arg 1.
 *   npx tsx src/scripts/testReceiptEmail.ts you@example.com
 * Needs RESEND_API_KEY set in .env (and the To address on a verified domain
 * while still in Resend's testing mode, or any address once out of sandbox).
 */
async function main() {
  const to = process.argv[2];
  if (!to) { console.error('Usage: tsx testReceiptEmail.ts <to-email>'); process.exit(1); }
  if (!isEmailConfigured()) { console.error('RESEND_API_KEY not set in .env'); process.exit(1); }

  const html = await render(
    createElement(ReceiptEmail, {
      firstName: 'Ryan',
      dealTitle: 'Microneedling + PRP',
      vendorName: 'Skin Studio Hillcrest',
      variantLabel: 'Single session',
      quantity: 1,
      amountPaidCents: 20000,
      codes: ['GLOE-7K2QX'],
      expiresAt: 'August 7, 2026',
      photoUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&h=480&fit=crop&q=80',
      walletUrl: 'https://gloe.app/wallet',
    }),
  );

  const res = await sendEmail({ to, subject: 'Your Microneedling + PRP receipt', html, idempotencyKey: `receipt-test-${Date.now()}` });
  console.log(res.sent ? `✓ sent (id ${res.id}) → ${to}` : `✗ not sent: ${res.error}`);
  process.exit(res.sent ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
