import type { Sql } from '../db/client';
import { type AuditAction, writeAudit } from './audit';
import type { StripeWebhookEvent } from './stripe';

/**
 * Mirrors connected-account payout lifecycle events into our `payouts` table.
 * Stripe sends:
 *   - payout.created   → first event, when Stripe (or we, via instant payout) initiates a transfer to the bank/card
 *   - payout.paid      → money arrived in the destination
 *   - payout.failed    → Stripe couldn't deliver (closed acct, wrong routing #, etc.)
 *   - payout.canceled  → Vendor or platform canceled before send
 *
 * The Stripe `event.account` field identifies which connected account the
 * payout belongs to — we resolve that to a Gloē vendor before writing.
 *
 * Idempotent at the row level via stripe_payout_id unique constraint.
 */
export async function handleStripePayoutWebhook(
  sql: Sql,
  event: StripeWebhookEvent,
): Promise<void> {
  const accountId = event.account;
  if (!accountId) {
    // Platform-level payout (not a Connect payout) — ignore for now. Our
    // `payouts` table is per-vendor; platform payouts aren't tracked here.
    return;
  }

  const vendorRows = await sql<{ id: string }[]>`
    SELECT id FROM public.vendors WHERE stripe_account_id = ${accountId} LIMIT 1
  `;
  const vendorId = vendorRows[0]?.id;
  if (!vendorId) {
    console.warn(`[payout webhook] no vendor for Stripe account ${accountId}`);
    return;
  }

  const obj = event.data.object as {
    id: string;
    amount?: number;
    currency?: string;
    arrival_date?: number;
    failure_message?: string | null;
  };

  const newStatus = (() => {
    switch (event.type) {
      case 'payout.created':  return 'pending';
      case 'payout.paid':     return 'paid';
      case 'payout.failed':   return 'failed';
      case 'payout.canceled': return 'cancelled';
      default:                return null;
    }
  })();
  if (!newStatus) return;

  const amountCents = obj.amount ?? 0;
  const currency = obj.currency ?? 'usd';
  const arrivalDate = obj.arrival_date ? new Date(obj.arrival_date * 1000).toISOString() : null;
  const failureMessage = obj.failure_message ?? null;

  // Upsert: payout.created might not have hit us (e.g., we missed the event),
  // and payout.paid should still land. ON CONFLICT updates status forward.
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO public.payouts (
      vendor_id, stripe_payout_id, amount_cents, currency, status,
      arrival_estimate_at, arrived_at, failure_message, created_at
    ) VALUES (
      ${vendorId}, ${obj.id}, ${amountCents}, ${currency}, ${newStatus},
      ${arrivalDate}, ${newStatus === 'paid' ? sql`now()` : null}, ${failureMessage}, now()
    )
    ON CONFLICT (stripe_payout_id) DO UPDATE
      SET status              = EXCLUDED.status,
          amount_cents        = EXCLUDED.amount_cents,
          arrival_estimate_at = EXCLUDED.arrival_estimate_at,
          arrived_at          = COALESCE(EXCLUDED.arrived_at, public.payouts.arrived_at),
          failure_message     = COALESCE(EXCLUDED.failure_message, public.payouts.failure_message)
    RETURNING id
  `;

  const auditAction: AuditAction | null = (() => {
    switch (event.type) {
      case 'payout.created': return 'payout.created';
      case 'payout.paid':    return 'payout.paid';
      case 'payout.failed':  return 'payout.failed';
      default:               return null;
    }
  })();
  if (auditAction) {
    void writeAudit(sql, {
      action: auditAction,
      vendorId,
      payoutId: inserted[0]?.id ?? null,
      meta: {
        stripePayoutId: obj.id,
        amountCents,
        failureMessage,
        eventType: event.type,
      },
    });
  }
}
