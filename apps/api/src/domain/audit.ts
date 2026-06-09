import type postgres from 'postgres';

import type { Sql } from '../db/client';

/**
 * Append-only audit log for the cross-cutting forensic record.
 *
 * Anything money-moving or admin-policy-changing should fire one line through
 * here. Per-feature domain tables (payouts, transactions, redemption_attempts)
 * remain the authoritative state — this layer answers "who, what, when, why"
 * across all of them in one query.
 *
 * Design rules:
 *  - **Never throw upward.** Audit failures must not break the user path.
 *    All writes are try/catch'd and logged to stderr on failure.
 *  - **Append only.** No code anywhere should UPDATE or DELETE rows.
 *  - **Add actions by extending AuditAction, not by passing free-form strings.**
 *    The compiler is the spec — if you grep `AuditAction` you see every
 *    auditable event in the system.
 *  - **Modular.** Every domain calls `writeAudit(sql, ...)` directly; there is
 *    no middleware coupling. Adding a new action is one enum entry + one call.
 */

export type AuditAction =
  // Redemption — note: lookupClaim/redeemClaim ALSO write to redemption_attempts
  // for richer per-attempt detail. The audit log row is the cross-system one.
  | 'redemption.success'
  | 'redemption.refused'
  // Stripe Transfer (Gloē platform → vendor Connect balance, fired on redemption)
  | 'transfer.created'
  | 'transfer.refused'
  // Instant Payout (vendor Connect balance → debit card, 3% fee)
  | 'instant_payout.requested'
  | 'instant_payout.refused'
  | 'instant_payout.toggled'
  // Standard payout (Stripe → bank, observed via webhook)
  | 'payout.created'
  | 'payout.paid'
  | 'payout.failed'
  // Fee tier policy
  | 'fee_tier.created'
  | 'fee_tier.updated'
  | 'fee_tier.deactivated'
  | 'fee_tier.reactivated'
  // Vendor admin
  | 'vendor.suspended'
  | 'vendor.reinstated'
  | 'vendor.auto_release.set'
  | 'vendor.auto_clawback.set'
  | 'vendor.stripe_onboarding.started'
  | 'vendor.admin_bypass.set'
  | 'vendor.google_place_linked'
  // License verification (GLO-19)
  | 'vendor.license_submitted'  // vendor sent license info + document for review
  | 'vendor.license_reviewed'   // admin approved or rejected the license
  // Claim & invite (GLO-5)
  | 'vendor.owner_invited'      // admin sent the Clerk invitation to the owner email
  | 'vendor.claimed'            // a signed-in user claimed an unclaimed vendor by verified email
  // Refunds
  | 'refund.issued'    // full refund of a transaction
  | 'refund.partial'   // partial refund (voucher stays alive)
  | 'refund.refused'   // request blocked by eligibility / Stripe error
  // Disputes / chargebacks (charge.dispute.* webhooks; system-driven)
  | 'dispute.opened'           // charge.dispute.created — froze unredeemed claims, halted payout
  | 'dispute.opened_redeemed'  // dispute hit an already-redeemed voucher — flagged for admin review
  | 'dispute.updated'          // charge.dispute.updated — lifecycle/status change
  | 'dispute.won'              // charge.dispute.closed, status=won — claims un-frozen
  | 'dispute.lost'             // charge.dispute.closed, status=lost — Stripe pulled the funds back
  | 'dispute.reconciled'       // admin clawed back the vendor's transfer after a lost dispute
  | 'dispute.reconcile_refused'// the claw-back was blocked (no transfer, etc.)
  // Deal admin
  | 'deal.admin_edited'  // god mode edited deal content (skips re-review)
  // Voucher admin (GLO-29)
  | 'claim.reissued'     // admin replaced an expired voucher with a fresh active one
  // Discover editorial sections (GLO-27)
  | 'discover_section.created'
  | 'discover_section.updated'
  | 'discover_section.deleted'
  // Support tickets
  | 'support.replied'      // agent replied to a support ticket
  | 'support.status_set'   // agent resolved / closed / reopened a ticket
  // Admin team management
  | 'admin.added'          // a user was granted admin access
  | 'admin.removed'        // an admin was revoked
  | 'admin.role_changed';  // an admin's role (owner/moderator) was changed

export interface AuditEntry {
  action: AuditAction;
  /** Who triggered this. NULL for system-driven events (webhooks, cron). */
  actorUserId?: string | null;
  /** What entity the action targeted. All optional — fill what's relevant. */
  vendorId?: string | null;
  claimId?: string | null;
  transactionId?: string | null;
  payoutId?: string | null;
  /**
   * Free-form details. Examples:
   *   { amountCents: 17600, stripeTransferId: 'tr_...' }
   *   { reason: 'NOT_YOURS', codeAttempted: 'GLOE-ABC...' }
   *   { before: { percentBps: 1200 }, after: { percentBps: 1400 } }
   * Keys are convention-only; pick the shape that's useful for grep later.
   */
  meta?: Record<string, unknown>;
}

/**
 * Write one audit row. Always returns — never throws to the caller.
 * Use `void writeAudit(...)` if you don't want to await.
 */
export async function writeAudit(sql: Sql, entry: AuditEntry): Promise<void> {
  try {
    await sql`
      INSERT INTO public.audit_log (
        action, actor_user_id, vendor_id, claim_id, transaction_id, payout_id, meta
      ) VALUES (
        ${entry.action},
        ${entry.actorUserId ?? null},
        ${entry.vendorId ?? null},
        ${entry.claimId ?? null},
        ${entry.transactionId ?? null},
        ${entry.payoutId ?? null},
        ${sql.json((entry.meta ?? {}) as unknown as postgres.JSONValue)}
      )
    `;
  } catch (e) {
    // Never break the caller's flow because of an audit write.
    // Print enough to find this row in stderr if the DB is the issue.
    console.error('[audit] failed to write', {
      action: entry.action,
      err: (e as Error).message,
    });
  }
}

/**
 * Convenience for the common "wrap a thing that might throw" pattern. Lets
 * callers express intent without writing two try/catch blocks:
 *
 *   await withAudit(sql, { action: 'transfer.created', vendorId }, async () => {
 *     return stripe.transfers.create(...);
 *   });
 *
 * On success → writes the audit row with the result merged into meta.
 * On failure → writes a paired '.refused' row (best-effort string transform)
 *   then rethrows so business logic still gets the error.
 *
 * Use when you want failure-and-success symmetry without boilerplate. Use
 * `writeAudit` directly when you need finer control over what's logged.
 */
export async function withAudit<T>(
  sql: Sql,
  baseEntry: AuditEntry,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    void writeAudit(sql, {
      ...baseEntry,
      meta: { ...(baseEntry.meta ?? {}), result },
    });
    return result;
  } catch (e) {
    const refusedAction = baseEntry.action.replace(/\.(success|created|requested|issued)$/, '.refused');
    void writeAudit(sql, {
      ...baseEntry,
      action: refusedAction as AuditAction,
      meta: {
        ...(baseEntry.meta ?? {}),
        error: e instanceof Error ? e.message : String(e),
      },
    });
    throw e;
  }
}
