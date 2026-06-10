import 'dotenv/config';

import { sql } from '../db/client';
import { inviteVendorOwner } from '../domain/vendorClaim';

/**
 * Re-send the GLO-5 owner invitation from the CLI (admin panel does the same
 * thing) — useful when testing the invited-owner sign-up while logged out.
 *   npx tsx src/scripts/resendVendorInvite.ts <owner-email> [web-origin]
 */
async function main() {
  const email = process.argv[2]?.toLowerCase();
  const origin = process.argv[3] ?? 'http://localhost:3000';
  if (!email) throw new Error('Usage: resendVendorInvite.ts <owner-email> [web-origin]');

  const vendors = await sql<{ id: string; business_name: string }[]>`
    SELECT id, business_name FROM public.vendors
    WHERE owner_user_id IS NULL AND lower(email) = ${email}
    ORDER BY created_at ASC
  `;
  if (vendors.length === 0) throw new Error(`No unclaimed vendor has email ${email}.`);
  if (vendors.length > 1) console.log(`Note: ${vendors.length} unclaimed vendors match; inviting for the oldest.`);

  const redirectUrl = `${origin}/sign-up?redirect_url=${encodeURIComponent('/vendor')}&invited_email=${encodeURIComponent(email)}`;
  const r = await inviteVendorOwner(sql, vendors[0]!.id, redirectUrl);
  console.log(`Invite sent to ${r.email} for "${vendors[0]!.business_name}" (invited_at=${r.invitedAt})`);
  console.log(`Redirect: ${redirectUrl}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void sql.end());
