import { createElement } from 'react';

import { render } from '@react-email/components';

import { PayoutEmail } from '../emails/PayoutEmail';
import { SupportReplyEmail } from '../emails/SupportReplyEmail';

/**
 * Renders the GLO-40 templates with sample data (no DB, no network) and
 * sanity-checks the output. Writes the HTML to /tmp for eyeballing.
 */
async function main() {
  const payout = await render(
    createElement(PayoutEmail, {
      businessName: 'Pacific Beach Aesthetics',
      dealTitle: '3 Sessions of Laser Hair Removal',
      amountCents: 14400,
      stripeDashboardUrl: 'https://connect.stripe.com/express_login',
    }),
  );
  if (!payout.includes('$144.00') || !payout.includes('You got paid')) throw new Error('payout render bad');

  const reply = await render(
    createElement(SupportReplyEmail, {
      firstName: 'Maya',
      subject: "Voucher won't scan",
      replyBody: 'Hi Maya — we reissued your voucher.\nThe new code is in your wallet.',
    }),
  );
  if (!reply.includes('reissued your voucher') || !reply.includes('Hi Maya,')) throw new Error('reply render bad');

  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/payout-email.html', payout);
  writeFileSync('/tmp/support-reply-email.html', reply);
  console.log('RENDER OK →', '/tmp/payout-email.html', '/tmp/support-reply-email.html');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
