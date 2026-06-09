import { clerk } from '../context/auth';
import type { Sql } from '../db/client';

/**
 * GLO-5: vendor claim & invite.
 *
 * Admins pre-create vendors "on behalf" (owner_user_id = null). Without a
 * claim path, the real owner signing up would create a DUPLICATE vendor.
 * The flow:
 *   1. Admin captures the owner's email on the vendor (create or later).
 *   2. "Invite owner" → Clerk invitation email → they sign up/sign in.
 *   3. claimVendorByEmail links an unclaimed vendor whose stored email
 *      matches one of the session user's VERIFIED Clerk emails.
 * Clerk stays the source of truth for identity — we never touch passwords.
 */

export interface ClaimResult {
  claimed: boolean;
  vendorId?: string;
  businessName?: string;
}

/**
 * Try to claim an unclaimed vendor for the signed-in user, matching the
 * vendor's stored email against the user's VERIFIED Clerk emails only —
 * an unverified address must never hand over a business account.
 * No-op (claimed:false) when the user already owns a vendor or nothing matches.
 */
export async function claimVendorByEmail(
  sql: Sql,
  userId: string,
  clerkUserId: string,
): Promise<ClaimResult> {
  const owned = await sql<{ id: string }[]>`
    SELECT id FROM public.vendors WHERE owner_user_id = ${userId} LIMIT 1
  `;
  if (owned[0]) return { claimed: false };

  const profile = await clerk.users.getUser(clerkUserId);
  const verifiedEmails = profile.emailAddresses
    .filter((e) => e.verification?.status === 'verified')
    .map((e) => e.emailAddress.toLowerCase());
  if (verifiedEmails.length === 0) return { claimed: false };

  // Oldest matching unclaimed vendor wins, atomically — two sessions racing
  // for the same vendor can't both take it (owner_user_id IS NULL recheck).
  const rows = await sql<{ id: string; business_name: string }[]>`
    UPDATE public.vendors v
    SET owner_user_id = ${userId}
    WHERE v.id = (
      SELECT id FROM public.vendors
      WHERE owner_user_id IS NULL
        AND lower(email) = ANY(${sql.array(verifiedEmails)})
      ORDER BY created_at ASC
      LIMIT 1
    ) AND v.owner_user_id IS NULL
    RETURNING v.id, v.business_name
  `;
  const v = rows[0];
  if (!v) return { claimed: false };
  return { claimed: true, vendorId: v.id, businessName: v.business_name };
}

export class InviteError extends Error {}

/**
 * Send (or resend) the Clerk invitation to a vendor's owner email. When
 * `email` is provided it's saved on the vendor first (covers vendors created
 * before the email field existed). Stamps owner_invited_at on success.
 *
 * If the address already has a Clerk account, Clerk refuses the invitation —
 * we surface that as "they can just sign in", because claimVendorByEmail
 * will pick the vendor up on their next visit to /vendor.
 */
export async function inviteVendorOwner(
  sql: Sql,
  vendorId: string,
  redirectUrl: string,
  email?: string | null,
): Promise<{ email: string; invitedAt: string }> {
  if (email) {
    await sql`UPDATE public.vendors SET email = ${email.toLowerCase()} WHERE id = ${vendorId}`;
  }
  const rows = await sql<{ email: string | null; owner_user_id: string | null; business_name: string }[]>`
    SELECT email, owner_user_id, business_name FROM public.vendors WHERE id = ${vendorId} LIMIT 1
  `;
  const v = rows[0];
  if (!v) throw new InviteError('Vendor not found.');
  if (v.owner_user_id) throw new InviteError('This vendor is already claimed.');
  if (!v.email) throw new InviteError('No owner email on file — add one first.');

  try {
    await clerk.invitations.createInvitation({
      emailAddress: v.email,
      redirectUrl,
      notify: true,
      // If they ignored an earlier invite, let the admin re-send it.
      ignoreExisting: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Clerk refuses to invite an email that already has an account. That's
    // fine for us — claiming only needs them to sign in at /vendor.
    if (/already.*(exist|sign|taken)|identifier/i.test(msg)) {
      throw new InviteError(
        `${v.email} already has an account — tell them to sign in at gloe.app/vendor and the business links automatically.`,
      );
    }
    throw new InviteError(`Clerk refused the invitation: ${msg}`);
  }

  const stamped = await sql<{ owner_invited_at: string }[]>`
    UPDATE public.vendors SET owner_invited_at = now() WHERE id = ${vendorId}
    RETURNING owner_invited_at
  `;
  return { email: v.email, invitedAt: stamped[0]!.owner_invited_at };
}
