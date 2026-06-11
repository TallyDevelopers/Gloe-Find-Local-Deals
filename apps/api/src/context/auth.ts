import { createClerkClient, verifyToken } from '@clerk/backend';

import { sql } from '../db/client';
import { attributeSignup, generateReferralCode } from '../domain/referrals';
import { sendWelcomeEmail } from '../domain/transactionalEmails';

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY;

if (!clerkSecretKey || !clerkPublishableKey) {
  throw new Error('Missing CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY');
}

export const clerk = createClerkClient({
  secretKey: clerkSecretKey,
  publishableKey: clerkPublishableKey,
});

export interface AuthInfo {
  clerkUserId: string;
  /** Internal user id. Lazily resolved/created from clerkUserId. */
  userId: string;
}

/**
 * Verifies a Clerk session token and returns the internal user id.
 * Creates a user row on first sight (just-in-time sync from Clerk).
 *
 * Referrals (GLO-24): clients with a pending invite code send it on every
 * request via the `x-gloe-referral-code` header (context.ts threads it here)
 * — the JIT insert is the one moment we know a signup is genuinely new, so
 * attribution fires right after the row lands. Fire-and-forget; a referral
 * hiccup must never fail the user's first authenticated request.
 */
export async function verifyAndResolveUser(
  token: string | undefined,
  opts: { referralCode?: string | null } = {},
): Promise<AuthInfo | null> {
  if (!token) return null;

  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, { secretKey: clerkSecretKey });
    clerkUserId = payload.sub;
  } catch {
    return null;
  }

  // Look up or create the user row mirrored from Clerk
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM public.users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
  `;
  if (existing[0]) {
    return { clerkUserId, userId: existing[0].id };
  }

  // First-time login — pull profile from Clerk and insert. Every user gets a
  // shareable referral code at birth; on the (1 in 29^6) collision, roll again.
  const profile = await clerk.users.getUser(clerkUserId);
  let row: { id: string } | undefined;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    try {
      const inserted = await sql<{ id: string }[]>`
        INSERT INTO public.users (clerk_user_id, email, first_name, last_name, image_url, referral_code)
        VALUES (
          ${clerkUserId},
          ${profile.primaryEmailAddress?.emailAddress ?? null},
          ${profile.firstName},
          ${profile.lastName},
          ${profile.imageUrl},
          ${generateReferralCode()}
        )
        RETURNING id
      `;
      row = inserted[0];
    } catch (e) {
      const pgErr = e as { code?: string; constraint_name?: string };
      if (pgErr.code === '23505' && pgErr.constraint_name === 'users_referral_code_key') continue;
      throw e;
    }
  }
  if (!row) {
    throw new Error('Failed to insert user');
  }
  // First signup just happened — send the one-time welcome email (GLO-28).
  // Not awaited: the user's first authenticated request must not wait on Resend.
  void sendWelcomeEmail(
    clerkUserId,
    profile.primaryEmailAddress?.emailAddress ?? null,
    profile.firstName,
  );
  // Pending invite code → attribute the signup (sets referred_by + grants the
  // referee's locked $20 lot). All refusal paths are audited inside.
  const code = opts.referralCode?.trim();
  if (code) {
    const userId = row.id;
    void attributeSignup(sql, {
      userId,
      code,
      email: profile.primaryEmailAddress?.emailAddress ?? null,
    }).catch((e) => console.error('[referral] attribution failed:', (e as Error).message));
  }
  return { clerkUserId, userId: row.id };
}
