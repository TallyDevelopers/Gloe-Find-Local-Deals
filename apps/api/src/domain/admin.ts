import type { Sql } from '../db/client';

/** True if the internal user id is in admin_users. */
export async function isAdmin(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM public.admin_users WHERE user_id = ${userId} LIMIT 1
  `;
  return rows.length > 0;
}

/** Platform-wide totals: gross volume, your income (fees), payouts, counts. */
export async function getOverview(sql: Sql) {
  const rows = await sql<{
    txn_count: number;
    gross_cents: number;
    income_cents: number;
    payout_cents: number;
    vendor_count: number;
    active_deal_count: number;
    income_30d_cents: number;
    gross_30d_cents: number;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM public.transactions WHERE status = 'paid') AS txn_count,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions WHERE status='paid'),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions WHERE status='paid'),0)::int AS income_cents,
      COALESCE((SELECT SUM(vendor_payout_cents) FROM public.transactions WHERE status='paid'),0)::int AS payout_cents,
      (SELECT COUNT(*)::int FROM public.vendors) AS vendor_count,
      (SELECT COUNT(*)::int FROM public.deals WHERE status='active') AS active_deal_count,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions WHERE status='paid' AND paid_at >= now() - interval '30 days'),0)::int AS income_30d_cents,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions WHERE status='paid' AND paid_at >= now() - interval '30 days'),0)::int AS gross_30d_cents
  `;
  const r = rows[0]!;
  return {
    txnCount: r.txn_count,
    grossCents: r.gross_cents,
    incomeCents: r.income_cents,
    payoutCents: r.payout_cents,
    vendorCount: r.vendor_count,
    activeDealCount: r.active_deal_count,
    income30dCents: r.income_30d_cents,
    gross30dCents: r.gross_30d_cents,
  };
}

/** Top vendors by revenue (your fee) and by purchase count. */
export async function getTopVendors(sql: Sql, limit = 10) {
  const rows = await sql<{
    vendor_id: string;
    business_name: string;
    purchases: number;
    gross_cents: number;
    income_cents: number;
  }[]>`
    SELECT v.id AS vendor_id, v.business_name,
      COUNT(t.id)::int AS purchases,
      COALESCE(SUM(t.consumer_paid_cents),0)::int AS gross_cents,
      COALESCE(SUM(t.platform_fee_cents),0)::int AS income_cents
    FROM public.vendors v
    JOIN public.transactions t ON t.vendor_id = v.id AND t.status = 'paid'
    GROUP BY v.id, v.business_name
    ORDER BY gross_cents DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    vendorId: r.vendor_id,
    businessName: r.business_name,
    purchases: r.purchases,
    grossCents: r.gross_cents,
    incomeCents: r.income_cents,
  }));
}

/** Full vendor roster with sales + payout/Stripe readiness for management. */
export async function getVendorRoster(sql: Sql) {
  const rows = await sql<{
    id: string;
    business_name: string;
    status: string;
    city: string;
    has_owner: boolean;
    license_number: string | null;
    stripe_account_status: string | null;
    google_place_id: string | null;
    deal_count: number;
    purchases: number;
    gross_cents: number;
    income_cents: number;
    created_at: string;
  }[]>`
    SELECT v.id, v.business_name, v.status, v.city,
      (v.owner_user_id IS NOT NULL) AS has_owner,
      v.license_number, v.stripe_account_status, v.google_place_id,
      (SELECT COUNT(*)::int FROM public.deals d WHERE d.vendor_id = v.id) AS deal_count,
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t WHERE t.vendor_id = v.id AND t.status='paid'),0) AS purchases,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t WHERE t.vendor_id = v.id AND t.status='paid'),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions t WHERE t.vendor_id = v.id AND t.status='paid'),0)::int AS income_cents,
      v.created_at
    FROM public.vendors v
    ORDER BY gross_cents DESC, v.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    businessName: r.business_name,
    status: r.status,
    city: r.city,
    hasOwner: r.has_owner,
    hasLicense: !!r.license_number,
    stripeStatus: r.stripe_account_status,
    hasGoogle: !!r.google_place_id,
    dealCount: r.deal_count,
    purchases: r.purchases,
    grossCents: r.gross_cents,
    incomeCents: r.income_cents,
    createdAt: r.created_at,
  }));
}

/** One vendor's profile + all their deals (any status) for the admin detail page. */
export async function getVendorDetail(sql: Sql, vendorId: string) {
  const vRows = await sql<{
    id: string;
    business_name: string;
    status: string;
    city: string;
    region: string;
    address_line1: string;
    phone: string;
    has_owner: boolean;
    admin_bypass: boolean;
    stripe_account_status: string | null;
    google_place_id: string | null;
    purchases: number;
    gross_cents: number;
    income_cents: number;
  }[]>`
    SELECT v.id, v.business_name, v.status, v.city, v.region, v.address_line1, v.phone,
      (v.owner_user_id IS NOT NULL) AS has_owner, v.admin_bypass,
      v.stripe_account_status, v.google_place_id,
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t WHERE t.vendor_id=v.id AND t.status='paid'),0) AS purchases,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t WHERE t.vendor_id=v.id AND t.status='paid'),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions t WHERE t.vendor_id=v.id AND t.status='paid'),0)::int AS income_cents
    FROM public.vendors v WHERE v.id = ${vendorId} LIMIT 1
  `;
  const v = vRows[0];
  if (!v) return null;

  // Payout health: totals by status + any recent failures with the reason.
  const payoutAgg = await sql<{
    paid_cents: number;
    pending_cents: number;
    failed_count: number;
  }[]>`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('paid','arrived')),0)::int AS paid_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('pending','in_transit')),0)::int AS pending_cents,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
    FROM public.payouts WHERE vendor_id = ${vendorId}
  `;
  const failures = await sql<{
    id: string;
    amount_cents: number;
    failure_message: string | null;
    created_at: string;
  }[]>`
    SELECT id, amount_cents, failure_message, created_at
    FROM public.payouts WHERE vendor_id = ${vendorId} AND status = 'failed'
    ORDER BY created_at DESC LIMIT 5
  `;
  const pa = payoutAgg[0]!;

  const deals = await sql<{
    id: string;
    title: string;
    status: string;
    category_name: string;
    expires_at: string;
    primary_photo_url: string | null;
    min_price_cents: number | null;
    variant_count: number;
    purchases: number;
  }[]>`
    SELECT d.id, d.title, d.status, c.display_name AS category_name, d.expires_at,
      (SELECT url FROM public.deal_photos p WHERE p.deal_id=d.id
        ORDER BY CASE WHEN p.photo_type='hero' THEN 0 ELSE 1 END, p.display_order LIMIT 1) AS primary_photo_url,
      (SELECT MIN(deal_price_cents) FROM public.deal_variants dv WHERE dv.deal_id=d.id) AS min_price_cents,
      (SELECT COUNT(*)::int FROM public.deal_variants dv WHERE dv.deal_id=d.id) AS variant_count,
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t JOIN public.claims cl ON cl.id=t.claim_id
                WHERE cl.deal_id=d.id AND t.status='paid'),0) AS purchases
    FROM public.deals d
    JOIN public.service_categories c ON c.id = d.category_id
    WHERE d.vendor_id = ${vendorId}
    ORDER BY d.created_at DESC
  `;

  return {
    vendor: {
      id: v.id,
      businessName: v.business_name,
      status: v.status,
      city: v.city,
      region: v.region,
      addressLine1: v.address_line1,
      phone: v.phone,
      hasOwner: v.has_owner,
      adminBypass: v.admin_bypass,
      stripeStatus: v.stripe_account_status,
      hasGoogle: !!v.google_place_id,
      purchases: v.purchases,
      grossCents: v.gross_cents,
      incomeCents: v.income_cents,
      // Their earnings = what's owed/paid to the vendor (gross minus your fee).
      vendorEarnedCents: v.gross_cents - v.income_cents,
      stripeConnected: v.stripe_account_status === 'active',
      payoutPaidCents: pa.paid_cents,
      payoutPendingCents: pa.pending_cents,
      payoutFailedCount: pa.failed_count,
      payoutFailures: failures.map((f) => ({
        id: f.id,
        amountCents: f.amount_cents,
        message: f.failure_message,
        createdAt: f.created_at,
      })),
    },
    deals: deals.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      categoryName: d.category_name,
      expiresAt: d.expires_at,
      primaryPhotoUrl: d.primary_photo_url,
      minPriceCents: d.min_price_cents,
      variantCount: d.variant_count,
      purchases: d.purchases,
    })),
  };
}

/** All deals awaiting review, newest first, with vendor name. */
export async function getPendingDeals(sql: Sql) {
  const rows = await sql<{
    id: string;
    title: string;
    vendor_id: string;
    business_name: string;
    category_name: string;
    primary_photo_url: string | null;
    min_price_cents: number | null;
    created_at: string;
  }[]>`
    SELECT d.id, d.title, d.vendor_id, v.business_name, c.display_name AS category_name,
      (SELECT url FROM public.deal_photos p WHERE p.deal_id=d.id
        ORDER BY CASE WHEN p.photo_type='hero' THEN 0 ELSE 1 END, p.display_order LIMIT 1) AS primary_photo_url,
      (SELECT MIN(deal_price_cents) FROM public.deal_variants dv WHERE dv.deal_id=d.id) AS min_price_cents,
      d.created_at
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    JOIN public.service_categories c ON c.id = d.category_id
    WHERE d.status = 'pending_review'
    ORDER BY d.created_at ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    vendorId: r.vendor_id,
    businessName: r.business_name,
    categoryName: r.category_name,
    primaryPhotoUrl: r.primary_photo_url,
    minPriceCents: r.min_price_cents,
    createdAt: r.created_at,
  }));
}

/**
 * Suspend a vendor (the kill switch): mark them suspended and pull every live
 * or pending deal down to draft so nothing of theirs shows in the app. Returns
 * how many deals were taken down. Unsuspend just reactivates the account; deals
 * stay drafted until someone re-publishes them.
 */
export async function setVendorSuspended(sql: Sql, vendorId: string, suspended: boolean) {
  if (suspended) {
    const pulled = await sql<{ id: string }[]>`
      UPDATE public.deals SET status = 'draft', updated_at = now()
      WHERE vendor_id = ${vendorId} AND status IN ('active', 'paused', 'pending_review')
      RETURNING id
    `;
    await sql`UPDATE public.vendors SET status = 'suspended' WHERE id = ${vendorId}`;
    return { suspended: true, dealsTakenDown: pulled.length };
  }
  await sql`UPDATE public.vendors SET status = 'active' WHERE id = ${vendorId}`;
  return { suspended: false, dealsTakenDown: 0 };
}

/** Approve or reject a pending deal. */
export async function reviewDeal(
  sql: Sql,
  adminUserId: string,
  dealId: string,
  decision: 'approve' | 'reject',
  reason?: string | null,
) {
  if (decision === 'approve') {
    await sql`
      UPDATE public.deals
      SET status = 'active', approved_at = now(), rejection_reason = NULL
      WHERE id = ${dealId} AND status = 'pending_review'
    `;
  } else {
    await sql`
      UPDATE public.deals
      SET status = 'rejected', rejection_reason = ${reason ?? null}
      WHERE id = ${dealId} AND status = 'pending_review'
    `;
  }
  return { ok: true };
}

/** Most recent purchases — the live pulse + your cue to call about first sales. */
export async function getRecentActivity(sql: Sql, limit = 20) {
  const rows = await sql<{
    id: string;
    business_name: string;
    consumer_paid_cents: number;
    platform_fee_cents: number;
    buyer: string | null;
    paid_at: string;
  }[]>`
    SELECT t.id, v.business_name,
      t.consumer_paid_cents, t.platform_fee_cents,
      u.first_name AS buyer, t.paid_at
    FROM public.transactions t
    JOIN public.vendors v ON v.id = t.vendor_id
    LEFT JOIN public.users u ON u.id = t.user_id
    WHERE t.status = 'paid'
    ORDER BY t.paid_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    businessName: r.business_name,
    consumerPaidCents: r.consumer_paid_cents,
    platformFeeCents: r.platform_fee_cents,
    buyer: r.buyer,
    paidAt: r.paid_at,
  }));
}
