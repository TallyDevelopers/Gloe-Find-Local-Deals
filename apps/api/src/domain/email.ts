import { Resend } from 'resend';

/**
 * The single door for ALL outbound transactional email (receipts, voucher
 * delivery, refund confirmations, payout notices, …). Mirrors the push
 * `sendNotification()` pattern: callers never touch Resend directly, and a
 * send NEVER throws into the caller's flow — a failed receipt must not roll
 * back a paid purchase. If RESEND_API_KEY is unset (e.g. local dev), this
 * no-ops and logs, so nothing breaks.
 *
 * Auth emails (verify/reset/magic-link) do NOT come through here — those are
 * Clerk's, branded in the Clerk dashboard (GLO-18).
 *
 * From: receipts@mail.gloe.app (verified sending subdomain).
 * Reply-To: support@gloe.app (a forwarder to a monitored inbox) so customer
 * replies reach a human.
 */

const FROM = process.env.EMAIL_FROM ?? 'Gloē <receipts@mail.gloe.app>';
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'support@gloe.app';

let _resend: Resend | null = null;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  /** Override sender, e.g. a personal founder address. Must be on the verified mail.gloe.app domain. */
  from?: string;
  /** Rendered HTML (from a React Email template via render()). */
  html: string;
  /** Plain-text fallback — improves deliverability; auto-derived if omitted. */
  text?: string;
  /** Per-send idempotency, e.g. `receipt:<txnId>` — Resend dedupes retries. */
  idempotencyKey?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ sent: boolean; id: string | null; error: string | null }> {
  const resend = client();
  if (!resend) {
    console.log(`[email] skipped (RESEND_API_KEY unset): "${args.subject}" → ${args.to}`);
    return { sent: false, id: null, error: 'not_configured' };
  }
  if (!args.to || !args.to.includes('@')) {
    console.warn(`[email] skipped — no valid recipient for "${args.subject}"`);
    return { sent: false, id: null, error: 'no_recipient' };
  }
  try {
    const { data, error } = await resend.emails.send(
      {
        from: args.from ?? FROM,
        to: args.to,
        replyTo: REPLY_TO,
        subject: args.subject,
        html: args.html,
        ...(args.text ? { text: args.text } : {}),
      },
      args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
    );
    if (error) {
      console.error(`[email] send failed: ${error.message}`);
      return { sent: false, id: null, error: error.message };
    }
    return { sent: true, id: data?.id ?? null, error: null };
  } catch (e) {
    console.error('[email] send threw:', (e as Error).message);
    return { sent: false, id: null, error: e instanceof Error ? e.message : 'unknown' };
  }
}
