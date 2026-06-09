import 'dotenv/config';

import { sql } from '../db/client';
import { sendNotification } from '../domain/notifications';

/**
 * One-off: fire a support_reply push and a review_prompt push (delay bypassed)
 * to the most-recently-seen iOS device. Run: npx tsx src/scripts/testPush.ts
 */
async function main() {
  const rows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM public.device_tokens
    WHERE platform = 'ios' ORDER BY last_seen_at DESC LIMIT 1
  `;
  const userId = rows[0]?.user_id;
  if (!userId) {
    console.log('No iOS device token found. Open the app on your phone first.');
    process.exit(1);
  }
  console.log('Target user:', userId);

  // 1) Support reply (immediate type — sends now)
  const support = await sendNotification(sql, 'support_reply', userId, {
    vars: { body: 'Thanks for reaching out — we just replied to your case ✨' },
    data: { type: 'support_reply', ticketId: 'test' },
  });
  console.log('support_reply →', JSON.stringify(support));

  // 2) Review prompt. This type has a 3h delay, so sendNotification would only
  //    ENQUEUE it. To test delivery now, fire the APNs push directly using the
  //    review_prompt copy/thread (what the cron would send when it comes due).
  const { sendApnsPushToUser } = await import('../domain/apns');
  const review = await sendApnsPushToUser(sql, userId, {
    title: 'How was your visit?',
    body: 'Leave a review for Test Spa ✨',
    data: { type: 'review_prompt', claimId: 'test' },
    threadId: 'reviews',
  });
  console.log('review_prompt →', JSON.stringify(review));

  await sql.end();
  process.exit(0);
}

void main();
