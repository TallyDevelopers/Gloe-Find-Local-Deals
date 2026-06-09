import { createClerkClient, verifyToken } from '@clerk/backend';

import { sql } from '../db/client';
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
 */
export async function verifyAndResolveUser(token: string | undefined): Promise<AuthInfo | null> {
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

  // First-time login — pull profile from Clerk and insert
  const profile = await clerk.users.getUser(clerkUserId);
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO public.users (clerk_user_id, email, first_name, last_name, image_url)
    VALUES (
      ${clerkUserId},
      ${profile.primaryEmailAddress?.emailAddress ?? null},
      ${profile.firstName},
      ${profile.lastName},
      ${profile.imageUrl}
    )
    RETURNING id
  `;
  const row = inserted[0];
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
  return { clerkUserId, userId: row.id };
}
