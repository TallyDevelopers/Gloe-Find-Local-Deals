import { clerk } from '../context/auth';
import type { Sql } from '../db/client';
import { forfeitAllForUser } from './credits';
import { hashEmailForDeletionGuard } from './referrals';

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
 *   2. BEFORE the scrub (while the email still exists): store the salted email
 *      hash in deleted_account_email_hashes (the GLO-24 referral/signup-bonus
 *      abuse guard — delete-and-resignup isn't "genuinely new") and forfeit
 *      every positive credit lot.
 *   3. Scrub all PII on the users row (email/phone/name/image/city → null).
 *   4. Tombstone clerk_user_id (it's NOT NULL) so nothing can ever re-link to it.
 *   5. Set deleted_at so auth + queries can treat the account as gone.
 *
 * CASCADE FKs (claims, reviews, saved_deals, saved_vendors, device_tokens,
 * message_threads, support_tickets) are removed automatically by the DB.
 * Transactions remain, now pointing at an anonymized row.
 */
export async function deleteAccount(
  sql: Sql,
  userId: string,
  clerkUserId: string,
): Promise<{ deleted: true; forfeitedCreditsCents: number }> {
  // 1. Kill the Clerk identity first. If this throws, we stop — better to fail
  //    loudly than scrub our DB while the login still works.
  try {
    await clerk.users.deleteUser(clerkUserId);
  } catch (e) {
    // If Clerk says the user is already gone, that's fine — proceed to scrub.
    const status = (e as { status?: number })?.status;
    if (status !== 404) throw e;
  }

  // 2. Credits (GLO-24) — must run while the email column is still populated.
  const emailRows = await sql<{ email: string | null }[]>`
    SELECT email FROM public.users WHERE id = ${userId} LIMIT 1
  `;
  const email = emailRows[0]?.email ?? null;
  if (email) {
    await sql`
      INSERT INTO public.deleted_account_email_hashes (email_hash)
      VALUES (${hashEmailForDeletionGuard(email)})
      ON CONFLICT (email_hash) DO NOTHING
    `;
  }
  const forfeited = await forfeitAllForUser(sql, userId, {
    actorUserId: userId,
    reason: 'account_deleted',
  });

  // 3-5. Scrub PII, tombstone the clerk id, mark deactivated. Idempotent.
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

  // Clients warn "you'll forfeit $X" pre-delete; the response confirms it.
  return { deleted: true, forfeitedCreditsCents: forfeited.forfeitedCents };
}
