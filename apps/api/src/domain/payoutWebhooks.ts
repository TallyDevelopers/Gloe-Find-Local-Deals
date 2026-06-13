import type { Sql } from '../db/client';
import { type AuditAction, writeAudit } from './audit';
import { freezeCreditLedger, unfreezeCreditLedger, unwindCreditsForTransaction } from './credits';
import type { StripeWebhookEvent } from './stripe';

/**
 * Shape of the Stripe Dispute object we care about (charge.dispute.* events).
 * `charge` and `payment_intent` are the two ways back to our transaction; we
 * match on payment_intent since that's what fulfillPurchase persists.
 */
interface StripeDispute {
  id: string;
  charge?: string | null;
  payment_intent?: string | null;
  status?: string | null;     // needs_response | warning_needs_response | under_review | won | lost | charge_refunded ...
  reason?: string | null;     // fraudulent | product_not_received | duplicate | ...
  amount?: number | null;
}

/**
 * Handles `charge.dispute.created`, `.updated`, and `.closed` — the
 * money-integrity wall (GLO-34). When a customer disputes/chargebacks a charge:
 *
 *   created → freeze every UNREDEEMED voucher on that transaction so it can no
 *             longer be redeemed (a disputer must not also walk away with the
 *             service), and mark the transaction `disputed` which halts the
 *             vendor payout (releaseTransferForClaim refuses unless txn status
 *             is `paid`). If a voucher was ALREADY redeemed, we leave it alone
 *             but flag the transaction for admin review (the service was
 *             delivered — admin decides comp vs. claw-back via forceRefundRedeemed).
 *
 *   updated → record the new dispute status (e.g. under_review) for visibility.
 *
 *   closed  → won: the dispute resolved in our favor → un-freeze the claims
 *                  back to `active` and restore the transaction to `paid` so the
 *                  voucher works again and the payout can release.
 *             lost: Stripe has pulled the funds; the freeze stands. Transaction
 *                  stays `disputed` (effectively a forced refund) and is flagged
 *                  for admin so any already-sent vendor transfer can be reversed.
 *
 * Disputes on platform (destination) charges fire on the PLATFORM account, so
 * there is no `event.account` to resolve — we go straight from the dispute's
 * payment_intent to our transaction. Idempotent: re-delivery of the same event
 * is a no-op on the freeze (claims are only flipped active→frozen) and the
 * status fields just re-set to the same values.
 */
export async function handleStripeDisputeWebhook(
  sql: Sql,
  event: StripeWebhookEvent,
): Promise<void> {
  const dispute = event.data.object as unknown as StripeDispute;
  const piId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : null;

  if (!piId && !chargeId) {
    console.warn(`[dispute webhook] ${event.type} has no payment_intent or charge; ignoring`);
    return;
  }

  // Find the transaction. Prefer payment_intent (always persisted by
  // fulfillPurchase); fall back to charge id if we ever backfilled it.
  const txnRows = await sql<{
    id: string;
    user_id: string;
    vendor_id: string;
    status: string;
    stripe_transfer_id: string | null;
    auto_clawback: boolean;
  }[]>`
    SELECT t.id, t.user_id, t.vendor_id, t.status, t.stripe_transfer_id,
           v.auto_clawback_on_dispute_lost AS auto_clawback
    FROM public.transactions t
    JOIN public.vendors v ON v.id = t.vendor_id
    WHERE (${piId}::text IS NOT NULL AND t.stripe_payment_intent_id = ${piId})
       OR (${chargeId}::text IS NOT NULL AND t.stripe_charge_id = ${chargeId})
    LIMIT 1
  `;
  const txn = txnRows[0];
  if (!txn) {
    console.warn(`[dispute webhook] no transaction for PI ${piId ?? '—'} / charge ${chargeId ?? '—'}`);
    return;
  }

  const status = dispute.status ?? null;
  const reason = dispute.reason ?? null;
  const isClosed = event.type === 'charge.dispute.closed';
  const isWon = isClosed && status === 'won';

  await sql.begin(async (tx) => {
    if (event.type === 'charge.dispute.created') {
      // Freeze every still-redeemable voucher on this transaction. Only flips
      // active→frozen, so re-delivery and partially-redeemed orders are safe.
      const frozen = await tx<{ id: string }[]>`
        UPDATE public.claims
        SET status = 'frozen'
        WHERE transaction_id = ${txn.id} AND status = 'active'
        RETURNING id
      `;
      // Any already-redeemed voucher on this txn → can't un-deliver; flag it.
      const redeemedRows = await tx<{ id: string }[]>`
        SELECT id FROM public.claims
        WHERE transaction_id = ${txn.id} AND status = 'redeemed'
      `;

      // Mark the transaction disputed. This is the payout wall:
      // releaseTransferForClaim refuses unless status='paid', so no new transfer
      // can fire while disputed. Backfill the charge id while we have it.
      await tx`
        UPDATE public.transactions
        SET status              = 'disputed',
            stripe_dispute_id   = ${dispute.id},
            dispute_status      = ${status},
            dispute_reason      = ${reason},
            disputed_at         = COALESCE(disputed_at, now()),
            stripe_charge_id    = COALESCE(stripe_charge_id, ${chargeId}),
            updated_at          = now()
        WHERE id = ${txn.id}
      `;

      // Freeze the disputer's credit ledger (GLO-24) — a chargeback filer
      // can't keep spending wallet credit while the money is in question.
      const froze = await freezeCreditLedger(tx, txn.user_id);
      if (froze) {
        void writeAudit(sql, {
          action: 'credit.frozen',
          transactionId: txn.id,
          meta: { userId: txn.user_id, stripeDisputeId: dispute.id, reason: 'dispute_opened' },
        });
      }

      void writeAudit(sql, {
        action: redeemedRows.length > 0 ? 'dispute.opened_redeemed' : 'dispute.opened',
        vendorId: txn.vendor_id,
        transactionId: txn.id,
        meta: {
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          paymentIntentId: piId,
          disputeStatus: status,
          disputeReason: reason,
          amountCents: dispute.amount ?? null,
          frozenClaimCount: frozen.length,
          redeemedClaimCount: redeemedRows.length,
          // The disputed txn may already have paid out the vendor on redemption.
          // Surface it so admin knows a transfer reversal may be owed.
          existingTransferId: txn.stripe_transfer_id,
          needsAdminReview: redeemedRows.length > 0 || !!txn.stripe_transfer_id,
        },
      });
      return;
    }

    if (isClosed && isWon) {
      // We won: undo the freeze. Restore claims that WE froze for this dispute
      // (frozen→active) and put the transaction back to paid so it can pay out.
      // Only restore claims that are still 'frozen' (don't resurrect ones an
      // admin separately cancelled/refunded).
      await tx`
        UPDATE public.claims
        SET status = 'active'
        WHERE transaction_id = ${txn.id} AND status = 'frozen'
      `;
      await tx`
        UPDATE public.transactions
        SET status              = 'paid',
            dispute_status      = ${status},
            dispute_resolved_at = now(),
            updated_at          = now()
        WHERE id = ${txn.id} AND status = 'disputed'
      `;
      // Won → thaw the customer's credit ledger (GLO-24).
      const thawed = await unfreezeCreditLedger(tx, txn.user_id);
      if (thawed) {
        void writeAudit(sql, {
          action: 'credit.unfrozen',
          transactionId: txn.id,
          meta: { userId: txn.user_id, stripeDisputeId: dispute.id, reason: 'dispute_won' },
        });
      }
      void writeAudit(sql, {
        action: 'dispute.won',
        vendorId: txn.vendor_id,
        transactionId: txn.id,
        meta: { stripeDisputeId: dispute.id, disputeStatus: status, disputeReason: reason },
      });
      return;
    }

    if (isClosed && !isWon) {
      // Lost (or otherwise closed against us): Stripe has already pulled the
      // funds. The freeze stands; the transaction remains effectively refunded.
      // If the vendor was already paid (a transfer exists) we'll claw it back
      // AFTER this transaction commits — automatically if their flag is on,
      // otherwise we flag it for an admin to do manually.
      await tx`
        UPDATE public.transactions
        SET dispute_status      = ${status},
            dispute_resolved_at = now(),
            updated_at          = now()
        WHERE id = ${txn.id}
      `;
      const willAutoClawback = !!txn.stripe_transfer_id && txn.auto_clawback;
      void writeAudit(sql, {
        action: 'dispute.lost',
        vendorId: txn.vendor_id,
        transactionId: txn.id,
        meta: {
          stripeDisputeId: dispute.id,
          disputeStatus: status,
          disputeReason: reason,
          existingTransferId: txn.stripe_transfer_id,
          autoClawbackEnabled: txn.auto_clawback,
          willAutoClawback,
          // Only needs a human if there's money to recover and auto is OFF.
          needsAdminReview: !!txn.stripe_transfer_id && !txn.auto_clawback,
        },
      });
      return;
    }

    // charge.dispute.updated — just record the lifecycle status change.
    await tx`
      UPDATE public.transactions
      SET dispute_status = ${status},
          dispute_reason = COALESCE(${reason}, dispute_reason),
          updated_at     = now()
      WHERE id = ${txn.id}
    `;
    void writeAudit(sql, {
      action: 'dispute.updated',
      vendorId: txn.vendor_id,
      transactionId: txn.id,
      meta: { stripeDisputeId: dispute.id, disputeStatus: status, disputeReason: reason },
    });
  });

  // Lost dispute (post-commit): claw back any credits this transaction EARNED
  // (purchase tier / referral, both sides — same unwind as refunds). The
  // ledger freeze STANDS on a loss — a successful chargeback is a fraud
  // signal; an admin can unfreeze manually. Idempotent + audited inside.
  if (isClosed && !isWon) {
    try {
      await unwindCreditsForTransaction(sql, txn.id, 'dispute_lost', null);
    } catch (e) {
      console.error('[dispute webhook] credit unwind failed:', (e as Error).message);
    }
  }

  // Auto-clawback (post-commit). On a LOST dispute where the vendor was already
  // paid AND their auto-clawback flag is on, reverse their transfer now so the
  // platform doesn't eat their share. Done OUTSIDE the transaction above because
  // it makes a Stripe call (transfers.createReversal) and writes its own audit.
  // Stripe lets the reversal push the vendor's balance negative and recoups it
  // from their future sales — that's how we actually recover the money.
  // actorUserId=null marks it as system/automatic. Refusals are audited inside
  // reconcileLostDispute; never let a Stripe hiccup throw out of the webhook.
  if (isClosed && !isWon && txn.stripe_transfer_id && txn.auto_clawback) {
    try {
      const { reconcileLostDispute } = await import('./vendorOps');
      const r = await reconcileLostDispute(sql, txn.id, null);
      if (r.reversed) {
        console.log(`[dispute webhook] auto-clawback reversed ${r.reversedCents}c for txn ${txn.id}`);
      } else {
        console.warn(`[dispute webhook] auto-clawback skipped for txn ${txn.id}: ${r.error}`);
      }
    } catch (e) {
      console.error('[dispute webhook] auto-clawback threw:', (e as Error).message);
    }
  }
}

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
