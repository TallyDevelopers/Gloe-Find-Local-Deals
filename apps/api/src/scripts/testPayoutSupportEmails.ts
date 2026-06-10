import 'dotenv/config';

import { createElement } from 'react';

import { render } from '@react-email/components';

import { PayoutEmail } from '../emails/PayoutEmail';
import { SupportReplyEmail } from '../emails/SupportReplyEmail';
import { sendEmail, isEmailConfigured } from '../domain/email';

/**
 * Sends the GLO-40 vendor-payout and support-reply emails to the address you
 * pass as arg 1, then polls Resend for each email's delivery status so the
 * result reflects actual delivery, not just API acceptance.
 *   npx tsx src/scripts/testPayoutSupportEmails.ts you@example.com
 */
async function pollStatus(id: string, label: string): Promise<string> {
  const key = process.env.RESEND_API_KEY!;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return `status check failed (HTTP ${res.status})`;
    const body = (await res.json()) as { last_event?: string };
    const ev = body.last_event ?? 'unknown';
    console.log(`  [${label}] last_event: ${ev}`);
    if (ev === 'delivered') return 'delivered';
    if (ev === 'bounced' || ev === 'complained' || ev === 'failed') return ev;
  }
  return 'still pending after 30s (check Resend dashboard)';
}

async function main() {
  const to = process.argv[2];
  if (!to) { console.error('Usage: tsx testPayoutSupportEmails.ts <to-email>'); process.exit(1); }
  if (!isEmailConfigured()) { console.error('RESEND_API_KEY not set in .env'); process.exit(1); }

  const payoutHtml = await render(
    createElement(PayoutEmail, {
      businessName: 'Skin Studio Hillcrest',
      dealTitle: 'Microneedling + PRP',
      amountCents: 16000,
      stripeDashboardUrl: 'https://connect.stripe.com/express_login',
    }),
  );
  const payout = await sendEmail({
    to,
    subject: 'You got paid $160.00 — Microneedling + PRP',
    html: payoutHtml,
    idempotencyKey: `payout-test-${Date.now()}`,
  });
  console.log(payout.sent ? `✓ payout accepted (id ${payout.id})` : `✗ payout not sent: ${payout.error}`);

  const supportHtml = await render(
    createElement(SupportReplyEmail, {
      firstName: 'Ryan',
      subject: 'Question about my voucher',
      replyBody:
        'Hi Ryan — thanks for reaching out! Your voucher is still active and valid through August 7. Just show the code at the front desk and they\'ll take care of you. Let us know if anything else comes up. ✨',
    }),
  );
  const support = await sendEmail({
    to,
    subject: 'Re: Question about my voucher',
    html: supportHtml,
    idempotencyKey: `support-reply-test-${Date.now()}`,
  });
  console.log(support.sent ? `✓ support reply accepted (id ${support.id})` : `✗ support reply not sent: ${support.error}`);

  if (!payout.sent || !support.sent) process.exit(1);

  console.log('\nVerifying delivery with Resend…');
  const [p, s] = await Promise.all([
    pollStatus(payout.id!, 'payout'),
    pollStatus(support.id!, 'support'),
  ]);
  console.log(`\npayout email:        ${p}`);
  console.log(`support reply email: ${s}`);
  process.exit(p === 'delivered' && s === 'delivered' ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
