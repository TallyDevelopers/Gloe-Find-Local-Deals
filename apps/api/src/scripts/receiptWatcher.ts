import 'dotenv/config';

import { createElement } from 'react';

import { render } from '@react-email/components';

import { sql } from '../db/client';
import { ReceiptEmail } from '../emails/ReceiptEmail';
import { sendEmail, isEmailConfigured } from '../domain/email';

/**
 * Stopgap until RESEND_API_KEY is set on Railway: prod fulfills purchases (it
 * owns the Stripe webhook) but can't email, so this watches for newly-paid
 * transactions and sends the real receipt from the local machine. Uses the
 * SAME idempotency key as checkout.ts (`receipt:<codes>`), so once prod can
 * send, Resend dedupes — no double receipts. Runs for 30 minutes, then exits.
 *   npx tsx src/scripts/receiptWatcher.ts
 */
const RUN_MINUTES = 30;
const POLL_MS = 3000;

async function main() {
  if (!isEmailConfigured()) { console.error('RESEND_API_KEY not set locally'); process.exit(1); }
  const startedAt = new Date().toISOString();
  const handled = new Set<string>();
  const deadline = Date.now() + RUN_MINUTES * 60_000;
  console.log(`[watcher] watching for purchases paid after ${startedAt} (${RUN_MINUTES}m)…`);

  while (Date.now() < deadline) {
    const txns = await sql<{
      id: string;
      user_email: string | null;
      payer_email: string | null;
      first_name: string | null;
      consumer_paid_cents: number;
    }[]>`
      SELECT t.id, u.email AS user_email, t.payer_email, u.first_name, t.consumer_paid_cents
      FROM public.transactions t
      LEFT JOIN public.users u ON u.id = t.user_id
      WHERE t.status = 'paid' AND t.paid_at >= ${startedAt}
      ORDER BY t.paid_at ASC
    `;
    for (const t of txns) {
      if (handled.has(t.id)) continue;
      handled.add(t.id);

      const claims = await sql<{
        human_code: string;
        expires_at: string;
        snapshot: { dealTitle?: string; vendorName?: string; variantLabel?: string };
        deal_id: string;
      }[]>`
        SELECT human_code, expires_at, snapshot, deal_id
        FROM public.claims WHERE transaction_id = ${t.id} ORDER BY created_at ASC
      `;
      if (claims.length === 0) { console.log(`[watcher] txn ${t.id}: paid but no claims yet, will retry`); handled.delete(t.id); continue; }

      const to = t.user_email ?? t.payer_email;
      if (!to) { console.log(`[watcher] txn ${t.id}: no recipient email, skipping`); continue; }

      const snap = claims[0]!.snapshot ?? {};
      const photoRows = await sql<{ url: string }[]>`
        SELECT url FROM public.deal_photos WHERE deal_id = ${claims[0]!.deal_id}
        ORDER BY CASE WHEN photo_type = 'hero' THEN 0 ELSE 1 END, display_order ASC LIMIT 1
      `;
      const codes = claims.map((c) => c.human_code);
      const expiresAt = new Date(claims[0]!.expires_at)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      const html = await render(
        createElement(ReceiptEmail, {
          firstName: t.first_name,
          dealTitle: snap.dealTitle ?? 'your purchase',
          vendorName: snap.vendorName ?? 'the spa',
          variantLabel: snap.variantLabel ?? '',
          quantity: codes.length,
          amountPaidCents: t.consumer_paid_cents,
          codes,
          expiresAt,
          photoUrl: photoRows[0]?.url ?? null,
          walletUrl: `${process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app'}/wallet`,
        }),
      );
      const res = await sendEmail({
        to,
        subject: `Your ${snap.dealTitle ?? 'Gloē'} receipt`,
        html,
        idempotencyKey: `receipt:${codes.join(',')}`,
      });
      console.log(res.sent
        ? `[watcher] ✓ receipt sent → ${to} (txn ${t.id}, codes ${codes.join(',')}, resend id ${res.id})`
        : `[watcher] ✗ receipt FAILED → ${to} (txn ${t.id}): ${res.error}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log('[watcher] window over, exiting.');
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
