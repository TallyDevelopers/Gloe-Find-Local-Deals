import type { Sql } from '../db/client';
import {
  createConnectedAccount,
  createDashboardLink,
  createOnboardingLink,
  getAccountStatus,
} from './stripe';

/**
 * Connect onboarding for a vendor. Creates their Express account if needed,
 * then returns a hosted onboarding link to hand them ("connect your bank").
 * Status (vendors.stripe_account_status) is synced from the webhook + on return.
 */
export async function startVendorOnboarding(
  sql: Sql,
  vendorId: string,
  urls: { refreshUrl: string; returnUrl: string },
): Promise<{ onboardingUrl: string }> {
  const rows = await sql<{
    id: string;
    business_name: string;
    email: string | null;
    stripe_account_id: string | null;
  }[]>`
    SELECT id, business_name, email, stripe_account_id
    FROM public.vendors WHERE id = ${vendorId} LIMIT 1
  `;
  const vendor = rows[0];
  if (!vendor) throw new Error('Vendor not found');

  let accountId = vendor.stripe_account_id;
  if (!accountId) {
    accountId = await createConnectedAccount({
      businessName: vendor.business_name,
      email: vendor.email,
    });
    await sql`
      UPDATE public.vendors
      SET stripe_account_id = ${accountId}, stripe_account_status = 'pending'
      WHERE id = ${vendorId}
    `;
  }

  const onboardingUrl = await createOnboardingLink({ accountId, ...urls });
  return { onboardingUrl };
}

/** Express dashboard login link for a vendor who's already connected. */
export async function getVendorDashboardLink(sql: Sql, vendorId: string): Promise<string> {
  const rows = await sql<{ stripe_account_id: string | null }[]>`
    SELECT stripe_account_id FROM public.vendors WHERE id = ${vendorId} LIMIT 1
  `;
  const accountId = rows[0]?.stripe_account_id;
  if (!accountId) throw new Error('Vendor has no Stripe account yet');
  return createDashboardLink(accountId);
}

/**
 * Pulls the live account status from Stripe and writes it to the vendor row.
 * Called by the webhook (account.updated) and on the onboarding return URL.
 * 'active' = payouts enabled (the gate for receiving money).
 */
export async function syncVendorStripeStatus(sql: Sql, accountId: string): Promise<void> {
  const status = await getAccountStatus(accountId);
  // Constraint allows: pending | restricted | active | rejected | disabled.
  // payouts enabled = active; everything pre-completion = pending.
  const value = status.payoutsEnabled ? 'active' : 'pending';
  await sql`
    UPDATE public.vendors
    SET stripe_account_status = ${value}
    WHERE stripe_account_id = ${accountId}
  `;
}
