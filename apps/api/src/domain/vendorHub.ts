import type { Sql } from '../db/client';
import { getConnectedAccountBalance, isStripeConfigured } from './stripe';

/**
 * Everything the vendor hub header + Today card needs in one query.
 * Stripe balance is fetched separately (see getStripeMoneyForVendor) because
 * it's an external call and we don't want it gating the rest of the page.
 */
export async function getVendorHubSnapshot(sql: Sql, vendorId: string) {
  const rows = await sql<{
    sold_today_count: number;
    sold_today_cents: number;
    redeemed_today: number;
    active_vouchers: number;
    next_redemption_at: string | null;
    held_count: number;
    held_cents: number;
    paid_7d_cents: number;
    in_transit_cents: number;
    failed_count: number;
  }[]>`
    SELECT
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t
        WHERE t.vendor_id=${vendorId} AND t.status IN ('paid','released')
          AND t.paid_at::date = current_date), 0) AS sold_today_count,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t
        WHERE t.vendor_id=${vendorId} AND t.status IN ('paid','released')
          AND t.paid_at::date = current_date), 0)::int AS sold_today_cents,

      COALESCE((SELECT COUNT(*)::int FROM public.claims c
        WHERE c.vendor_id=${vendorId} AND c.status='redeemed'
          AND c.redeemed_at::date = current_date), 0) AS redeemed_today,

      COALESCE((SELECT COUNT(*)::int FROM public.claims c
        WHERE c.vendor_id=${vendorId} AND c.status='active' AND c.expires_at > now()), 0) AS active_vouchers,
      (SELECT MIN(c.expires_at) FROM public.claims c
        WHERE c.vendor_id=${vendorId} AND c.status='active' AND c.expires_at > now()) AS next_redemption_at,

      COALESCE((SELECT COUNT(*)::int FROM public.claims c
        JOIN public.transactions t ON t.id=c.transaction_id
        WHERE c.vendor_id=${vendorId} AND c.status='redeemed'
          AND t.status='paid' AND t.stripe_transfer_id IS NULL), 0) AS held_count,
      COALESCE((SELECT SUM(t.vendor_payout_cents) FROM public.claims c
        JOIN public.transactions t ON t.id=c.transaction_id
        WHERE c.vendor_id=${vendorId} AND c.status='redeemed'
          AND t.status='paid' AND t.stripe_transfer_id IS NULL), 0)::int AS held_cents,

      COALESCE((SELECT SUM(amount_cents) FROM public.payouts
        WHERE vendor_id=${vendorId} AND status IN ('paid','arrived')
          AND created_at >= now() - interval '7 days'), 0)::int AS paid_7d_cents,
      COALESCE((SELECT SUM(amount_cents) FROM public.payouts
        WHERE vendor_id=${vendorId} AND status IN ('pending','in_transit')), 0)::int AS in_transit_cents,
      COALESCE((SELECT COUNT(*)::int FROM public.payouts
        WHERE vendor_id=${vendorId} AND status='failed'), 0) AS failed_count
  `;
  const r = rows[0]!;
  return {
    soldToday: { count: r.sold_today_count, cents: r.sold_today_cents },
    redeemedToday: r.redeemed_today,
    activeVouchers: { count: r.active_vouchers, nextExpiresAt: r.next_redemption_at },
    held: { count: r.held_count, cents: r.held_cents },
    paid7dCents: r.paid_7d_cents,
    inTransitCents: r.in_transit_cents,
    failedPayoutCount: r.failed_count,
  };
}

/**
 * Live balance from Stripe for a connected account. Returns nulls if the
 * vendor isn't onboarded yet or if Stripe is unreachable — never throws,
 * because this is a dashboard widget, not a checkout path.
 */
export async function getStripeMoneyForVendor(
  sql: Sql,
  vendorId: string,
): Promise<{ availableCents: number | null; pendingCents: number | null }> {
  if (!isStripeConfigured()) return { availableCents: null, pendingCents: null };
  const rows = await sql<{ stripe_account_id: string | null }[]>`
    SELECT stripe_account_id FROM public.vendors WHERE id = ${vendorId} LIMIT 1
  `;
  const accountId = rows[0]?.stripe_account_id;
  if (!accountId) return { availableCents: null, pendingCents: null };
  try {
    return await getConnectedAccountBalance(accountId);
  } catch {
    return { availableCents: null, pendingCents: null };
  }
}

export type VoucherTab = 'active' | 'redeemed' | 'past';

/**
 * Voucher list for the vendor's "Vouchers" card.
 * - active   = unredeemed, not expired
 * - redeemed = redeemed (any time)
 * - past     = expired or cancelled
 *
 * Capped at 50 rows per tab — if vendors run high volume we'll paginate.
 */
export async function listVendorVouchers(
  sql: Sql,
  vendorId: string,
  tab: VoucherTab,
) {
  const rows = await sql<{
    claim_id: string;
    deal_title: string;
    variant_label: string;
    deal_price_cents: number;
    status: string;
    customer_first_name: string | null;
    created_at: string;
    expires_at: string;
    redeemed_at: string | null;
    human_code: string;
  }[]>`
    SELECT
      c.id                              AS claim_id,
      c.snapshot ->> 'dealTitle'        AS deal_title,
      c.snapshot ->> 'variantLabel'     AS variant_label,
      (c.snapshot ->> 'dealPriceCents')::int AS deal_price_cents,
      c.status                          AS status,
      u.first_name                      AS customer_first_name,
      c.created_at                      AS created_at,
      c.expires_at                      AS expires_at,
      c.redeemed_at                     AS redeemed_at,
      c.human_code                      AS human_code
    FROM public.claims c
    JOIN public.users u ON u.id = c.user_id
    WHERE c.vendor_id = ${vendorId}
      AND CASE
        WHEN ${tab} = 'active'   THEN c.status = 'active' AND c.expires_at > now()
        WHEN ${tab} = 'redeemed' THEN c.status = 'redeemed'
        ELSE c.status IN ('expired','cancelled')
             OR (c.status = 'active' AND c.expires_at <= now())
      END
    ORDER BY
      CASE WHEN ${tab} = 'active' THEN c.expires_at END ASC,
      CASE WHEN ${tab} <> 'active' THEN COALESCE(c.redeemed_at, c.created_at) END DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    claimId: r.claim_id,
    dealTitle: r.deal_title,
    variantLabel: r.variant_label,
    dealPriceCents: r.deal_price_cents,
    status: r.status,
    customerFirstName: r.customer_first_name,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    humanCode: r.human_code,
  }));
}
