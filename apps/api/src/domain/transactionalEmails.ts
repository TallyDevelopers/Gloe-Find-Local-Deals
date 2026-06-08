import { createElement } from 'react';

import { render } from '@react-email/components';

import type { Sql } from '../db/client';
import { RefundEmail } from '../emails/RefundEmail';
import { ExpiringEmail } from '../emails/ExpiringEmail';
import { sendEmail } from './email';

function walletUrl(): string {
  return `${process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app'}/wallet`;
}

/**
 * Refund confirmation (GLO-38). Keyed off the transaction id — looks up the
 * recipient + deal context itself, so both refund paths in vendorOps.ts just
 * call this and don't thread email data through. Fire-and-forget; never throws.
 */
export async function sendRefundEmail(
  sql: Sql,
  transactionId: string,
  amountCents: number,
  isFullRefund: boolean,
): Promise<void> {
  try {
    const rows = await sql<{
      email: string | null;
      payer_email: string | null;
      first_name: string | null;
      deal_title: string | null;
      vendor_name: string | null;
    }[]>`
      SELECT u.email, t.payer_email, u.first_name,
             (c.snapshot ->> 'dealTitle')  AS deal_title,
             (c.snapshot ->> 'vendorName') AS vendor_name
      FROM public.transactions t
      LEFT JOIN public.users u ON u.id = t.user_id
      LEFT JOIN public.claims c ON c.transaction_id = t.id
      WHERE t.id = ${transactionId}
      LIMIT 1
    `;
    const r = rows[0];
    const to = r?.email ?? r?.payer_email ?? null;
    if (!to) return;

    const html = await render(
      createElement(RefundEmail, {
        firstName: r?.first_name ?? null,
        dealTitle: r?.deal_title ?? 'your purchase',
        vendorName: r?.vendor_name ?? 'the spa',
        amountCents,
        isFullRefund,
      }),
    );
    await sendEmail({
      to,
      subject: `Your refund from Gloē`,
      html,
      // refunded_cents grows with each partial refund → unique per refund action.
      idempotencyKey: `refund:${transactionId}:${amountCents}:${isFullRefund ? 'full' : 'partial'}`,
    });
  } catch (e) {
    console.error('[refund email] failed:', (e as Error).message);
  }
}

/**
 * Voucher-expiring reminder sweep (GLO-39). Expiry is lazy (nothing flips a
 * voucher to 'expired'), so this scan finds still-active, unredeemed claims
 * whose expiry lands inside the reminder window and emails once. The
 * `expiry_reminded_at` column dedupes — a claim is reminded at most once, so
 * overlapping/missed daily ticks are harmless.
 *
 * Window: claims expiring within REMIND_WITHIN_DAYS and not already past. We
 * stamp expiry_reminded_at on send so the next sweep skips them.
 */
const REMIND_WITHIN_DAYS = 7;

export async function sendExpiryReminders(sql: Sql): Promise<{ sent: number; skipped: number }> {
  const due = await sql<{
    id: string;
    human_code: string;
    expires_at: string;
    email: string | null;
    first_name: string | null;
    deal_title: string | null;
    vendor_name: string | null;
  }[]>`
    SELECT c.id, c.human_code, c.expires_at,
           u.email, u.first_name,
           (c.snapshot ->> 'dealTitle')  AS deal_title,
           (c.snapshot ->> 'vendorName') AS vendor_name
    FROM public.claims c
    JOIN public.users u ON u.id = c.user_id
    WHERE c.status = 'active'
      AND c.expiry_reminded_at IS NULL
      AND c.expires_at > now()
      AND c.expires_at <= now() + (${REMIND_WITHIN_DAYS} || ' days')::interval
      AND u.email IS NOT NULL
    ORDER BY c.expires_at ASC
    LIMIT 200
  `;

  let sent = 0;
  let skipped = 0;
  for (const c of due) {
    const expiresDate = new Date(c.expires_at);
    const daysLeft = Math.max(1, Math.ceil((expiresDate.getTime() - Date.now()) / 86_400_000));
    try {
      const html = await render(
        createElement(ExpiringEmail, {
          firstName: c.first_name,
          dealTitle: c.deal_title ?? 'your voucher',
          vendorName: c.vendor_name ?? 'the spa',
          code: c.human_code,
          expiresAt: expiresDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          daysLeft,
          walletUrl: walletUrl(),
        }),
      );
      const res = await sendEmail({
        to: c.email!,
        subject: `Your ${c.deal_title ?? 'Gloē'} voucher expires soon`,
        html,
        idempotencyKey: `expiry:${c.id}`,
      });
      // Stamp regardless of send result so we don't hammer a bad address daily;
      // a transient Resend error is acceptable to drop (reminder is best-effort).
      await sql`UPDATE public.claims SET expiry_reminded_at = now() WHERE id = ${c.id}`;
      if (res.sent) sent++; else skipped++;
    } catch (e) {
      skipped++;
      console.error(`[expiry email] claim ${c.id} failed:`, (e as Error).message);
    }
  }
  return { sent, skipped };
}
