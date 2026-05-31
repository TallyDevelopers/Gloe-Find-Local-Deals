import { clerk } from '../context/auth';
import type { Sql } from '../db/client';

/**
 * Delete a consumer account (Apple guideline 5.1.1(v) — in-app account deletion
 * is mandatory for any app with sign-up).
 *
 * We CANNOT hard-delete the user row: `transactions.user_id` is RESTRICT and
 * `audit_log` / `redemption_attempts` are NO ACTION — financial + audit records
 * must survive for tax, chargeback, and vendor-payout integrity. So this is an
 * anonymize-and-deactivate:
 *
 *   1. Delete the Clerk identity → the login is permanently dead (can't sign back in).
 *   2. Scrub all PII on the users row (email/phone/name/image/city → null).
 *   3. Tombstone clerk_user_id (it's NOT NULL) so nothing can ever re-link to it.
 *   4. Set deleted_at so auth + queries can treat the account as gone.
 *
 * CASCADE FKs (claims, reviews, saved_deals, saved_vendors, device_tokens,
 * message_threads, support_tickets) are removed automatically by the DB.
 * Transactions remain, now pointing at an anonymized row.
 */
export async function deleteAccount(
  sql: Sql,
  userId: string,
  clerkUserId: string,
): Promise<{ deleted: true }> {
  // 1. Kill the Clerk identity first. If this throws, we stop — better to fail
  //    loudly than scrub our DB while the login still works.
  try {
    await clerk.users.deleteUser(clerkUserId);
  } catch (e) {
    // If Clerk says the user is already gone, that's fine — proceed to scrub.
    const status = (e as { status?: number })?.status;
    if (status !== 404) throw e;
  }

  // 2-4. Scrub PII, tombstone the clerk id, mark deactivated. Idempotent.
  await sql`
    UPDATE public.users
    SET email        = NULL,
        phone        = NULL,
        first_name   = NULL,
        last_name    = NULL,
        image_url    = NULL,
        selected_city = NULL,
        clerk_user_id = ${`deleted:${userId}`},
        deleted_at   = now(),
        updated_at   = now()
    WHERE id = ${userId}
  `;

  return { deleted: true };
}
