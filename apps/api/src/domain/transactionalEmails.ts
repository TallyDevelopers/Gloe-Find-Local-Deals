import { createElement } from 'react';

import { render } from '@react-email/components';

import type { Sql } from '../db/client';
import { CreditGrantedEmail } from '../emails/CreditGrantedEmail';
import { RefundEmail } from '../emails/RefundEmail';
import { ExpiringEmail } from '../emails/ExpiringEmail';
import { PayoutEmail } from '../emails/PayoutEmail';
import { SupportReplyEmail } from '../emails/SupportReplyEmail';
import { WelcomeEmail } from '../emails/WelcomeEmail';
import { sendEmail } from './email';

function webOrigin(): string {
  return process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app';
}

function walletUrl(): string {
  return `${webOrigin()}/wallet`;
}

/**
 * One-time welcome email (GLO-28), fired when the user row is first inserted
 * (just-in-time sync in auth.ts) — the insert happens exactly once per Clerk
 * user, so this naturally sends once per signup, never on login. The
 * idempotency key guards the rare double-insert race. Fire-and-forget; a
 * failed welcome must never fail the user's first authenticated request.
 *
 * CTA points at the location-aware discover page (web root). Swap to the
 * GLO-14 Universal Link once that ships.
 */
export async function sendWelcomeEmail(
  clerkUserId: string,
  email: string | null,
  firstName: string | null,
): Promise<void> {
  if (!email) return;
  try {
    const html = await render(
      createElement(WelcomeEmail, {
        firstName,
        discoverUrl: webOrigin(),
      }),
    );
    await sendEmail({
      to: email,
      subject: firstName ? `Welcome to Gloē, ${firstName}` : 'Welcome to Gloē',
      html,
      // Keyed by Clerk id (not internal id) so a concurrent first-request
      // double-insert still resolves to one send.
      idempotencyKey: `welcome:${clerkUserId}`,
    });
  } catch (e) {
    console.error('[welcome email] failed:', (e as Error).message);
  }
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
      consumer_paid_cents: number;
      refunded_cents: number;
      deal_title: string | null;
      vendor_name: string | null;
    }[]>`
      SELECT u.email, t.payer_email, u.first_name,
             t.consumer_paid_cents, t.refunded_cents,
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
        originalPaidCents: r?.consumer_paid_cents ?? amountCents,
        amountCents,
        // refunded_cents is read AFTER the refund row updated it, so it's the cumulative total.
        totalRefundedCents: r?.refunded_cents ?? amountCents,
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
 * Wallet credit landed (GLO-24) — the branded sibling of the `credit_granted`
 * push. Fired for campaign blasts and god-mode manual grants (grantCredit
 * passes `sendEmail: true`); programmatic earns like refund returns stay
 * push-only. Keyed per lot so a campaign retry can't double-send.
 * Fire-and-forget; never throws.
 */
export async function sendCreditGrantedEmail(
  sql: Sql,
  args: {
    userId: string;
    lotId: string;
    amountCents: number;
    /** ISO timestamp (or null) straight off the lot row. */
    expiresAt: string | null;
    message?: string | null;
  },
): Promise<void> {
  try {
    const rows = await sql<{ email: string | null; first_name: string | null }[]>`
      SELECT email, first_name FROM public.users WHERE id = ${args.userId} LIMIT 1
    `;
    const r = rows[0];
    if (!r?.email) return;

    const expiresAt = args.expiresAt
      ? new Date(args.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    const html = await render(
      createElement(CreditGrantedEmail, {
        firstName: r.first_name,
        amountCents: args.amountCents,
        expiresAt,
        message: args.message ?? null,
        browseUrl: webOrigin(),
      }),
    );
    const amount = '$' + (args.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    await sendEmail({
      to: r.email,
      subject: `You've got ${amount} in Gloē credit`,
      html,
      idempotencyKey: `credit-granted:${args.lotId}`,
    });
  } catch (e) {
    console.error('[credit granted email] failed:', (e as Error).message);
  }
}

/**
 * Vendor payout notice (GLO-40) — fired right after the Stripe transfer for a
 * redeemed claim succeeds. Keyed off the claim: looks up the vendor's email
 * (the owner account's email, falling back to the business email on file) and
 * the deal title from the claim snapshot. Fire-and-forget; never throws —
 * a failed email must never unwind a successful money movement.
 */
export async function sendVendorPayoutEmail(
  sql: Sql,
  claimId: string,
  amountCents: number,
  stripeTransferId: string,
): Promise<void> {
  try {
    const rows = await sql<{
      business_name: string;
      vendor_email: string | null;
      owner_email: string | null;
      deal_title: string | null;
    }[]>`
      SELECT v.business_name,
             v.email AS vendor_email,
             u.email AS owner_email,
             (c.snapshot ->> 'dealTitle') AS deal_title
      FROM public.claims c
      JOIN public.vendors v ON v.id = c.vendor_id
      LEFT JOIN public.users u ON u.id = v.owner_user_id
      WHERE c.id = ${claimId}
      LIMIT 1
    `;
    const r = rows[0];
    const to = r?.owner_email ?? r?.vendor_email ?? null;
    if (!r || !to) return;

    const html = await render(
      createElement(PayoutEmail, {
        businessName: r.business_name,
        dealTitle: r.deal_title ?? 'a redeemed voucher',
        amountCents,
        stripeDashboardUrl: 'https://connect.stripe.com/express_login',
      }),
    );
    await sendEmail({
      to,
      subject: `You got paid ${'$' + (amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} — ${r.deal_title ?? 'Gloē'}`,
      html,
      // One email per transfer, however many times the caller retries.
      idempotencyKey: `payout:${stripeTransferId}`,
    });
  } catch (e) {
    console.error('[payout email] failed:', (e as Error).message);
  }
}

/**
 * Support reply notice (GLO-40) — fired when an agent replies to a ticket.
 * Includes the agent's reply text in full (the customer can read the answer
 * without opening the app). Fire-and-forget; never throws.
 */
export async function sendSupportReplyEmail(
  sql: Sql,
  ticketId: string,
  messageId: string,
  replyBody: string,
): Promise<void> {
  try {
    const rows = await sql<{
      email: string | null;
      first_name: string | null;
      subject: string;
    }[]>`
      SELECT u.email, u.first_name, t.subject
      FROM public.support_tickets t
      JOIN public.users u ON u.id = t.user_id
      WHERE t.id = ${ticketId}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r?.email) return;

    const html = await render(
      createElement(SupportReplyEmail, {
        firstName: r.first_name,
        subject: r.subject,
        replyBody,
      }),
    );
    await sendEmail({
      to: r.email,
      subject: `Re: ${r.subject}`,
      html,
      idempotencyKey: `support-reply:${messageId}`,
    });
  } catch (e) {
    console.error('[support reply email] failed:', (e as Error).message);
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
