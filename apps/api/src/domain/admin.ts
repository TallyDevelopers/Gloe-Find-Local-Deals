import type { Sql } from '../db/client';
import {
  insertAttachments,
  attachmentsForMessages,
  type AttachmentInput,
} from './supportAttachments';
import { getDisputeRiskConfig } from './platformSettings';

/* ============================================================
 * Global search — powers the ⌘K palette in god mode.
 * Returns up to 5 hits per entity type. Cheap ILIKE; revisit when
 * volume warrants a real search index.
 * ============================================================ */
export interface SearchHit {
  kind: 'vendor' | 'customer' | 'transaction' | 'deal';
  id: string;
  title: string;
  subtitle: string;
  /** Route to navigate to when the user picks this hit. */
  href: string;
}

export async function searchEverything(sql: Sql, query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [vendors, customers, transactions, deals] = await Promise.all([
    sql<{ id: string; business_name: string; city: string; stripe_account_status: string | null }[]>`
      SELECT id, business_name, city, stripe_account_status
      FROM public.vendors
      WHERE business_name ILIKE ${like}
      ORDER BY business_name LIMIT 5
    `,
    sql<{ id: string; first_name: string | null; last_name: string | null; email: string | null }[]>`
      SELECT id, first_name, last_name, email
      FROM public.users
      WHERE (first_name ILIKE ${like} OR last_name ILIKE ${like} OR email ILIKE ${like})
      ORDER BY first_name LIMIT 5
    `,
    sql<{ id: string; stripe_payment_intent_id: string | null; consumer_paid_cents: number; status: string; business_name: string }[]>`
      SELECT t.id, t.stripe_payment_intent_id, t.consumer_paid_cents, t.status, v.business_name
      FROM public.transactions t
      JOIN public.vendors v ON v.id = t.vendor_id
      WHERE t.stripe_payment_intent_id ILIKE ${like}
         OR t.id::text = ${q}
      ORDER BY t.created_at DESC LIMIT 5
    `,
    sql<{ id: string; title: string; business_name: string; vendor_id: string }[]>`
      SELECT d.id, d.title, v.business_name, v.id AS vendor_id
      FROM public.deals d
      JOIN public.vendors v ON v.id = d.vendor_id
      WHERE d.title ILIKE ${like}
      ORDER BY d.created_at DESC LIMIT 5
    `,
  ]);

  const hits: SearchHit[] = [];
  for (const v of vendors) {
    hits.push({
      kind: 'vendor',
      id: v.id,
      title: v.business_name,
      subtitle: `${v.city} · Stripe ${v.stripe_account_status ?? 'none'}`,
      href: `/admin/vendor/${v.id}`,
    });
  }
  for (const c of customers) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || (c.email ?? 'Unnamed user');
    hits.push({
      kind: 'customer',
      id: c.id,
      title: name,
      subtitle: c.email ?? c.id,
      href: `/admin?tab=customers&customer=${c.id}`,
    });
  }
  for (const t of transactions) {
    hits.push({
      kind: 'transaction',
      id: t.id,
      title: `$${(t.consumer_paid_cents / 100).toFixed(2)} · ${t.business_name}`,
      subtitle: `${t.status} · ${t.stripe_payment_intent_id ?? t.id.slice(0, 8)}`,
      href: `/admin?tab=transactions&tx=${t.id}`,
    });
  }
  for (const d of deals) {
    hits.push({
      kind: 'deal',
      id: d.id,
      title: d.title,
      subtitle: d.business_name,
      // Deal detail lives on its vendor's page — route to the vendor, not the deal id.
      href: `/admin/vendor/${d.vendor_id}`,
    });
  }
  return hits;
}

/* ============================================================
 * Pulse — at-a-glance "right now" for the admin home.
 * Optimized for frequent polling; everything resolvable in <50ms.
 * ============================================================ */
/**
 * The founder operating dashboard. One mega-query that tells you everything
 * you need to know about the business state right now — money position,
 * day/week/month rollups, vendor health, and operational alerts.
 *
 * Hot path — polled every 10s by the Pulse view. Keep it index-friendly.
 * The Stripe live balance is fetched separately (network call) by
 * getStripeBalanceForPlatform.
 */
export async function getAdminPulse(sql: Sql) {
  const rows = await sql<{
    // --- Today (kept for backward compat) ---
    paid_today_cents: number;
    paid_today_count: number;
    fee_today_cents: number;
    redemptions_today: number;
    in_flight_cents: number;
    in_flight_count: number;
    failed_payouts: number;
    pending_deals: number;
    vendors_blocked: number;
    vendors_total: number;
    // --- Money position ---
    owed_active_cents: number;        // bought but not redeemed (we hold this till redemption)
    owed_redeemed_cents: number;      // redeemed but not yet transferred (we owe this NOW)
    refund_liability_cents: number;   // refunds pending settlement (rare, but possible)
    // --- Time rollups ---
    paid_yesterday_cents: number;
    fee_yesterday_cents: number;
    paid_week_cents: number;
    fee_week_cents: number;
    paid_month_cents: number;
    fee_month_cents: number;
    refunded_today_cents: number;
    refunded_week_cents: number;
    refunded_month_cents: number;
    // --- Vendor health ---
    vendors_active_count: number;
    vendors_with_held_money_count: number;
    vendors_stale_30d_count: number;
    // --- Operational alerts ---
    vouchers_expiring_7d: number;
    refunds_recent_7d: number;
    audit_warnings_24h: number;
  }[]>`
    SELECT
      -- Today
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at::date = current_date), 0)::int AS paid_today_cents,
      COALESCE((SELECT COUNT(*) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at::date = current_date), 0)::int AS paid_today_count,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at::date = current_date), 0)::int AS fee_today_cents,
      COALESCE((SELECT COUNT(*) FROM public.claims
                WHERE status = 'redeemed' AND redeemed_at::date = current_date), 0)::int AS redemptions_today,
      COALESCE((SELECT SUM(t.vendor_payout_cents)
                FROM public.claims c
                JOIN public.transactions t ON t.id = c.transaction_id
                WHERE c.status = 'redeemed' AND t.status = 'paid' AND t.stripe_transfer_id IS NULL), 0)::int AS in_flight_cents,
      COALESCE((SELECT COUNT(*)
                FROM public.claims c
                JOIN public.transactions t ON t.id = c.transaction_id
                WHERE c.status = 'redeemed' AND t.status = 'paid' AND t.stripe_transfer_id IS NULL), 0)::int AS in_flight_count,
      COALESCE((SELECT COUNT(*) FROM public.payouts WHERE status = 'failed'), 0)::int AS failed_payouts,
      COALESCE((SELECT COUNT(*) FROM public.deals WHERE status = 'pending_review'), 0)::int AS pending_deals,
      COALESCE((SELECT COUNT(*) FROM public.vendors WHERE stripe_account_status != 'active'), 0)::int AS vendors_blocked,
      (SELECT COUNT(*) FROM public.vendors)::int AS vendors_total,

      -- Money position: what we owe vendors but haven't sent yet.
      -- Active claims = customer paid but hasn't redeemed; if they redeem, we transfer.
      COALESCE((SELECT SUM(t.vendor_payout_cents)
                FROM public.claims c
                JOIN public.transactions t ON t.id = c.transaction_id
                WHERE c.status = 'active' AND t.status = 'paid' AND t.stripe_transfer_id IS NULL), 0)::int AS owed_active_cents,
      -- Redeemed but not yet transferred (auto-release off, or transfer refused). We owe this NOW.
      COALESCE((SELECT SUM(t.vendor_payout_cents)
                FROM public.claims c
                JOIN public.transactions t ON t.id = c.transaction_id
                WHERE c.status = 'redeemed' AND t.status = 'paid' AND t.stripe_transfer_id IS NULL), 0)::int AS owed_redeemed_cents,
      -- Refund liability (customer is owed money back, refund not yet completed in Stripe)
      0::int AS refund_liability_cents,

      -- Time rollups
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at::date = current_date - 1), 0)::int AS paid_yesterday_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at::date = current_date - 1), 0)::int AS fee_yesterday_cents,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at >= current_date - INTERVAL '7 days'), 0)::int AS paid_week_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at >= current_date - INTERVAL '7 days'), 0)::int AS fee_week_cents,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at >= date_trunc('month', current_date)), 0)::int AS paid_month_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions
                WHERE status IN ('paid','released','partially_refunded')
                  AND paid_at >= date_trunc('month', current_date)), 0)::int AS fee_month_cents,
      COALESCE((SELECT SUM(refunded_cents) FROM public.transactions
                WHERE refunded_at::date = current_date), 0)::int AS refunded_today_cents,
      COALESCE((SELECT SUM(refunded_cents) FROM public.transactions
                WHERE refunded_at >= current_date - INTERVAL '7 days'), 0)::int AS refunded_week_cents,
      COALESCE((SELECT SUM(refunded_cents) FROM public.transactions
                WHERE refunded_at >= date_trunc('month', current_date)), 0)::int AS refunded_month_cents,

      -- Vendor health
      COALESCE((SELECT COUNT(*) FROM public.vendors WHERE stripe_account_status = 'active'), 0)::int AS vendors_active_count,
      -- Vendors who have at least one redeemed-but-unreleased payout (we're holding their money)
      COALESCE((SELECT COUNT(DISTINCT c.vendor_id)
                FROM public.claims c
                JOIN public.transactions t ON t.id = c.transaction_id
                WHERE c.status = 'redeemed' AND t.status = 'paid' AND t.stripe_transfer_id IS NULL), 0)::int AS vendors_with_held_money_count,
      -- Active vendors with no sales in 30 days (churn risk signal)
      COALESCE((SELECT COUNT(*) FROM public.vendors v
                WHERE v.status = 'active' AND v.stripe_account_status = 'active'
                  AND NOT EXISTS (
                    SELECT 1 FROM public.transactions t
                    WHERE t.vendor_id = v.id
                      AND t.status IN ('paid','released','partially_refunded')
                      AND t.paid_at >= current_date - INTERVAL '30 days'
                  )), 0)::int AS vendors_stale_30d_count,

      -- Operational alerts
      COALESCE((SELECT COUNT(*) FROM public.claims
                WHERE status = 'active'
                  AND expires_at BETWEEN now() AND now() + INTERVAL '7 days'), 0)::int AS vouchers_expiring_7d,
      COALESCE((SELECT COUNT(*) FROM public.transactions
                WHERE status IN ('refunded','partially_refunded')
                  AND refunded_at >= current_date - INTERVAL '7 days'), 0)::int AS refunds_recent_7d,
      COALESCE((SELECT COUNT(*) FROM public.audit_log
                WHERE action IN ('transfer.refused','refund.refused','payout.failed')
                  AND created_at >= now() - INTERVAL '24 hours'), 0)::int AS audit_warnings_24h
  `;
  return rows[0]!;
}

/* ============================================================
 * Transactions explorer — list + filter + detail.
 * Backs the Transactions tab and the side-panel drill-in.
 * ============================================================ */
export interface TransactionListFilters {
  status?: string[];
  vendorId?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive lower bound on paid_at. */
  since?: string;
  /** ISO date string (YYYY-MM-DD) — inclusive upper bound on paid_at. */
  until?: string;
  query?: string;
  limit?: number;
}

export async function listAdminTransactions(sql: Sql, filters: TransactionListFilters) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const statuses = (filters.status && filters.status.length > 0)
    ? filters.status
    : ['paid', 'released', 'partially_refunded', 'refunded', 'pending_payment', 'failed', 'disputed'];
  const sinceClause = filters.since ?? '1970-01-01';
  const untilClause = filters.until ?? '2999-01-01';
  const vendorIdOrNull = filters.vendorId ?? null;
  const queryLike = filters.query ? `%${filters.query}%` : null;

  const rows = await sql<{
    id: string;
    status: string;
    consumer_paid_cents: number;
    platform_fee_cents: number;
    vendor_payout_cents: number;
    stripe_payment_intent_id: string | null;
    stripe_transfer_id: string | null;
    paid_at: string | null;
    released_at: string | null;
    created_at: string;
    vendor_id: string;
    business_name: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    claim_status: string | null;
  }[]>`
    SELECT
      t.id, t.status, t.consumer_paid_cents, t.platform_fee_cents, t.vendor_payout_cents,
      t.stripe_payment_intent_id, t.stripe_transfer_id, t.paid_at, t.released_at, t.created_at,
      v.id AS vendor_id, v.business_name,
      u.id AS customer_id,
      COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS customer_name,
      u.email AS customer_email,
      (SELECT c.status FROM public.claims c WHERE c.transaction_id = t.id LIMIT 1) AS claim_status
    FROM public.transactions t
    JOIN public.vendors v ON v.id = t.vendor_id
    LEFT JOIN public.users u ON u.id = t.user_id
    WHERE t.status = ANY(${sql.array(statuses)})
      AND (${vendorIdOrNull}::uuid IS NULL OR t.vendor_id = ${vendorIdOrNull}::uuid)
      AND COALESCE(t.paid_at, t.created_at) >= ${sinceClause}::timestamptz
      AND COALESCE(t.paid_at, t.created_at) < (${untilClause}::date + INTERVAL '1 day')
      AND (${queryLike}::text IS NULL
           OR v.business_name ILIKE ${queryLike}
           OR u.email ILIKE ${queryLike}
           OR u.first_name ILIKE ${queryLike}
           OR u.last_name ILIKE ${queryLike}
           OR t.stripe_payment_intent_id ILIKE ${queryLike})
    ORDER BY COALESCE(t.paid_at, t.created_at) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    consumerPaidCents: r.consumer_paid_cents,
    platformFeeCents: r.platform_fee_cents,
    vendorPayoutCents: r.vendor_payout_cents,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    stripeTransferId: r.stripe_transfer_id,
    paidAt: r.paid_at,
    releasedAt: r.released_at,
    createdAt: r.created_at,
    vendorId: r.vendor_id,
    vendorName: r.business_name,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    claimStatus: r.claim_status,
  }));
}

/**
 * Set the editorial "Gloē's take" + quick perk chips on a spa. Admin-only.
 * Take is trimmed (null when blank); perks are trimmed, deduped, capped at 6.
 */
export async function setVendorTake(sql: Sql, vendorId: string, take: string | null, perks: string[]) {
  const cleanTake = take && take.trim() !== '' ? take.trim() : null;
  const cleanPerks = Array.from(new Set(perks.map((p) => p.trim()).filter(Boolean))).slice(0, 6);
  await sql`
    UPDATE public.vendors
       SET gloe_take = ${cleanTake}, gloe_perks = ${sql.array(cleanPerks)}
     WHERE id = ${vendorId}::uuid
  `;
  return { ok: true, gloeTake: cleanTake, gloePerks: cleanPerks };
}

export async function getAdminTransactionDetail(sql: Sql, transactionId: string) {
  const rows = await sql<{
    id: string;
    status: string;
    consumer_paid_cents: number;
    platform_fee_cents: number;
    vendor_payout_cents: number;
    stripe_fee_cents: number;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    stripe_transfer_id: string | null;
    paid_at: string | null;
    released_at: string | null;
    refunded_at: string | null;
    created_at: string;
    platform_fee_snapshot: Record<string, unknown> | null;
    stripe_dispute_id: string | null;
    dispute_status: string | null;
    dispute_reason: string | null;
    disputed_at: string | null;
    dispute_resolved_at: string | null;
    vendor_id: string;
    business_name: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
  }[]>`
    SELECT
      t.id, t.status, t.consumer_paid_cents, t.platform_fee_cents, t.vendor_payout_cents, t.stripe_fee_cents,
      t.stripe_payment_intent_id, t.stripe_charge_id, t.stripe_transfer_id,
      t.paid_at, t.released_at, t.refunded_at, t.created_at, t.platform_fee_snapshot,
      t.stripe_dispute_id, t.dispute_status, t.dispute_reason, t.disputed_at, t.dispute_resolved_at,
      v.id AS vendor_id, v.business_name,
      u.id AS customer_id,
      COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS customer_name,
      u.email AS customer_email
    FROM public.transactions t
    JOIN public.vendors v ON v.id = t.vendor_id
    LEFT JOIN public.users u ON u.id = t.user_id
    WHERE t.id = ${transactionId}
    LIMIT 1
  `;
  const t = rows[0];
  if (!t) return null;

  const claims = await sql<{
    id: string;
    status: string;
    redeemed_at: string | null;
    expires_at: string;
    human_code: string;
    snapshot: Record<string, unknown>;
  }[]>`
    SELECT id, status, redeemed_at, expires_at, human_code, snapshot
    FROM public.claims
    WHERE transaction_id = ${transactionId}
    ORDER BY created_at ASC
  `;

  const audit = await sql<{
    id: string;
    action: string;
    actor_user_id: string | null;
    meta: Record<string, unknown>;
    created_at: string;
  }[]>`
    SELECT id, action, actor_user_id, meta, created_at
    FROM public.audit_log
    WHERE transaction_id = ${transactionId}
       OR claim_id IN (SELECT id FROM public.claims WHERE transaction_id = ${transactionId})
    ORDER BY created_at DESC
    LIMIT 25
  `;

  return {
    transaction: {
      id: t.id,
      status: t.status,
      consumerPaidCents: t.consumer_paid_cents,
      platformFeeCents: t.platform_fee_cents,
      vendorPayoutCents: t.vendor_payout_cents,
      stripeFeeCents: t.stripe_fee_cents,
      stripePaymentIntentId: t.stripe_payment_intent_id,
      stripeChargeId: t.stripe_charge_id,
      stripeTransferId: t.stripe_transfer_id,
      paidAt: t.paid_at,
      releasedAt: t.released_at,
      refundedAt: t.refunded_at,
      createdAt: t.created_at,
      platformFeeSnapshot: t.platform_fee_snapshot,
      stripeDisputeId: t.stripe_dispute_id,
      disputeStatus: t.dispute_status,
      disputeReason: t.dispute_reason,
      disputedAt: t.disputed_at,
      disputeResolvedAt: t.dispute_resolved_at,
    },
    vendor: { id: t.vendor_id, name: t.business_name },
    customer: t.customer_id
      ? { id: t.customer_id, name: t.customer_name, email: t.customer_email }
      : null,
    claims: claims.map((c) => ({
      id: c.id,
      status: c.status,
      redeemedAt: c.redeemed_at,
      expiresAt: c.expires_at,
      humanCode: c.human_code,
      snapshot: c.snapshot,
    })),
    audit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      actorUserId: a.actor_user_id,
      meta: a.meta,
      createdAt: a.created_at,
    })),
  };
}

/* ============================================================
 * Customers explorer
 * ============================================================ */
export async function listAdminCustomers(sql: Sql, query: string | undefined) {
  const queryLike = query && query.trim().length >= 2 ? `%${query.trim()}%` : null;
  const rows = await sql<{
    id: string;
    display_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
    purchase_count: number;
    lifetime_paid_cents: number;
    last_paid_at: string | null;
  }[]>`
    SELECT
      u.id, u.display_id, u.first_name, u.last_name, u.email, u.phone, u.created_at,
      COALESCE((SELECT COUNT(*) FROM public.transactions t
                WHERE t.user_id = u.id AND t.status IN ('paid','released','partially_refunded')), 0)::int AS purchase_count,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t
                WHERE t.user_id = u.id AND t.status IN ('paid','released','partially_refunded')), 0)::int AS lifetime_paid_cents,
      (SELECT MAX(paid_at) FROM public.transactions t WHERE t.user_id = u.id) AS last_paid_at
    FROM public.users u
    WHERE (${queryLike}::text IS NULL
           OR u.first_name ILIKE ${queryLike}
           OR u.last_name ILIKE ${queryLike}
           OR u.email ILIKE ${queryLike}
           OR u.phone ILIKE ${queryLike})
    ORDER BY COALESCE((SELECT MAX(paid_at) FROM public.transactions t WHERE t.user_id = u.id), u.created_at) DESC
    LIMIT 100
  `;
  return rows.map((r) => ({
    id: r.id,
    displayId: r.display_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    phone: r.phone,
    createdAt: r.created_at,
    purchaseCount: r.purchase_count,
    lifetimePaidCents: r.lifetime_paid_cents,
    lastPaidAt: r.last_paid_at,
  }));
}

export async function getAdminCustomerDetail(sql: Sql, customerId: string) {
  const rows = await sql<{
    id: string;
    display_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
  }[]>`
    SELECT id, display_id, first_name, last_name, email, phone, created_at
    FROM public.users WHERE id = ${customerId} LIMIT 1
  `;
  const u = rows[0];
  if (!u) return null;

  const transactions = await sql<{
    id: string;
    display_id: string;
    status: string;
    consumer_paid_cents: number;
    refunded_cents: number;
    paid_at: string | null;
    created_at: string;
    vendor_id: string;
    vendor_name: string;
    claim_status: string | null;
    deal_title: string | null;
  }[]>`
    SELECT
      t.id, t.display_id, t.status, t.consumer_paid_cents, t.refunded_cents, t.paid_at, t.created_at,
      t.vendor_id,
      v.business_name AS vendor_name,
      (SELECT c.status FROM public.claims c WHERE c.transaction_id = t.id LIMIT 1) AS claim_status,
      (SELECT (c.snapshot ->> 'dealTitle') FROM public.claims c WHERE c.transaction_id = t.id LIMIT 1) AS deal_title
    FROM public.transactions t
    JOIN public.vendors v ON v.id = t.vendor_id
    WHERE t.user_id = ${customerId}
    ORDER BY COALESCE(t.paid_at, t.created_at) DESC
    LIMIT 100
  `;

  const totals = await sql<{
    purchase_count: number;
    lifetime_paid_cents: number;
    refunded_cents: number;
    redemption_count: number;
  }[]>`
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE status IN ('paid','released','partially_refunded')), 0)::int AS purchase_count,
      COALESCE(SUM(consumer_paid_cents) FILTER (WHERE status IN ('paid','released','partially_refunded')), 0)::int AS lifetime_paid_cents,
      COALESCE(SUM(consumer_paid_cents) FILTER (WHERE status IN ('refunded','partially_refunded')), 0)::int AS refunded_cents,
      (SELECT COUNT(*)::int FROM public.claims c WHERE c.user_id = ${customerId} AND c.status = 'redeemed') AS redemption_count
    FROM public.transactions WHERE user_id = ${customerId}
  `;

  return {
    customer: {
      id: u.id,
      displayId: u.display_id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone,
      createdAt: u.created_at,
    },
    totals: totals[0]!,
    transactions: transactions.map((t) => ({
      id: t.id,
      displayId: t.display_id,
      status: t.status,
      consumerPaidCents: t.consumer_paid_cents,
      refundedCents: t.refunded_cents,
      paidAt: t.paid_at,
      createdAt: t.created_at,
      vendorId: t.vendor_id,
      vendorName: t.vendor_name,
      claimStatus: t.claim_status,
      dealTitle: t.deal_title,
    })),
  };
}

/* ============================================================
 * Payouts explorer
 * ============================================================ */
export async function listAdminPayouts(sql: Sql, filters: { status?: string[]; vendorId?: string; limit?: number }) {
  const limit = Math.min(filters.limit ?? 100, 200);
  const statuses = (filters.status && filters.status.length > 0)
    ? filters.status
    : ['pending', 'in_transit', 'paid', 'failed', 'cancelled'];
  const vendorIdOrNull = filters.vendorId ?? null;
  const rows = await sql<{
    id: string;
    vendor_id: string;
    vendor_name: string;
    stripe_payout_id: string;
    amount_cents: number;
    currency: string;
    status: string;
    arrival_estimate_at: string | null;
    arrived_at: string | null;
    failure_message: string | null;
    created_at: string;
  }[]>`
    SELECT p.id, p.vendor_id, v.business_name AS vendor_name,
           p.stripe_payout_id, p.amount_cents, p.currency, p.status,
           p.arrival_estimate_at, p.arrived_at, p.failure_message, p.created_at
    FROM public.payouts p
    JOIN public.vendors v ON v.id = p.vendor_id
    WHERE p.status = ANY(${sql.array(statuses)})
      AND (${vendorIdOrNull}::uuid IS NULL OR p.vendor_id = ${vendorIdOrNull}::uuid)
    ORDER BY
      CASE WHEN p.status = 'failed' THEN 0 ELSE 1 END,
      p.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    vendorId: r.vendor_id,
    vendorName: r.vendor_name,
    stripePayoutId: r.stripe_payout_id,
    amountCents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    arrivalEstimateAt: r.arrival_estimate_at,
    arrivedAt: r.arrived_at,
    failureMessage: r.failure_message,
    createdAt: r.created_at,
  }));
}

/* ============================================================
 * Audit log explorer
 * ============================================================ */
export async function listAdminAuditLog(sql: Sql, filters: {
  action?: string;
  vendorId?: string;
  actorUserId?: string;
  limit?: number;
}) {
  const limit = Math.min(filters.limit ?? 100, 200);
  const actionLike = filters.action && filters.action.trim().length > 0 ? `${filters.action.trim()}%` : null;
  const vendorIdOrNull = filters.vendorId ?? null;
  const actorOrNull = filters.actorUserId ?? null;
  const rows = await sql<{
    id: string;
    action: string;
    actor_user_id: string | null;
    actor_email: string | null;
    actor_first: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
    claim_id: string | null;
    transaction_id: string | null;
    payout_id: string | null;
    meta: Record<string, unknown>;
    created_at: string;
  }[]>`
    SELECT
      a.id, a.action, a.actor_user_id,
      u.email AS actor_email, u.first_name AS actor_first,
      a.vendor_id, v.business_name AS vendor_name,
      a.claim_id, a.transaction_id, a.payout_id,
      a.meta, a.created_at
    FROM public.audit_log a
    LEFT JOIN public.users u ON u.id = a.actor_user_id
    LEFT JOIN public.vendors v ON v.id = a.vendor_id
    WHERE (${actionLike}::text IS NULL OR a.action LIKE ${actionLike})
      AND (${vendorIdOrNull}::uuid IS NULL OR a.vendor_id = ${vendorIdOrNull}::uuid)
      AND (${actorOrNull}::uuid IS NULL OR a.actor_user_id = ${actorOrNull}::uuid)
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorUserId: r.actor_user_id,
    actorName: r.actor_first ?? r.actor_email ?? null,
    vendorId: r.vendor_id,
    vendorName: r.vendor_name,
    claimId: r.claim_id,
    transactionId: r.transaction_id,
    payoutId: r.payout_id,
    meta: r.meta,
    createdAt: r.created_at,
  }));
}

/* ============================================================
 * Refund ledger — the dedicated, forensic view of every refund.
 *
 * The audit_log is the source of truth (each refund writes a
 * refund.issued / refund.partial row, blocked attempts write
 * refund.refused). This denormalizes those rows against the order,
 * customer, vendor, and transaction so god-mode gets a complete
 * picture in one query: who refunded, when, for how much, against
 * which order, whether the voucher was already redeemed, and why.
 * ============================================================ */

export interface AdminRefundRow {
  /** audit_log.id — stable key + the target of cross-link highlighting. */
  id: string;
  action: 'refund.issued' | 'refund.partial' | 'refund.refused';
  /** True for refund.issued/partial, false for a blocked attempt. */
  succeeded: boolean;
  /** True only for a full refund (voucher cancelled). */
  isFullRefund: boolean;
  /** When the refund happened. */
  refundedAt: string;
  /** Who clicked refund (god-mode operator). null ⇒ system. */
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  /** The amount refunded on THIS action (cents). For refused rows, the attempted amount. */
  amountCents: number;
  /** Cumulative refunded on the transaction after this action (cents). */
  cumulativeRefundedCents: number | null;
  /** What the customer originally paid (cents). */
  consumerPaidCents: number | null;
  /** Operator-entered reason. */
  reason: string | null;
  /** Stripe refund id (re_…), null for refused/failed. */
  stripeRefundId: string | null;
  /** For a refused row: why it was blocked. */
  refusedReason: string | null;
  // ─── Order context ───
  transactionId: string | null;
  transactionDisplayId: string | null;
  claimId: string | null;
  claimDisplayId: string | null;
  /** Order (claim) status right now: active / redeemed / expired / cancelled. */
  claimStatus: string | null;
  /** When the order was purchased. */
  orderPlacedAt: string | null;
  /** When (if) it was redeemed — the key "was it already used?" signal. */
  redeemedAt: string | null;
  /** Convenience flag mirrored from redeemedAt for the UI. */
  wasRedeemedBeforeRefund: boolean;
  dealTitle: string | null;
  // ─── Customer ───
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  // ─── Vendor ───
  vendorId: string | null;
  vendorName: string | null;
}

export async function listAdminRefunds(sql: Sql, filters: {
  /** 'succeeded' (issued+partial), 'refused', or undefined for all. */
  outcome?: 'succeeded' | 'refused';
  vendorId?: string;
  customerId?: string;
  limit?: number;
}): Promise<AdminRefundRow[]> {
  const limit = Math.min(filters.limit ?? 100, 300);
  const outcome = filters.outcome ?? null;
  const vendorIdOrNull = filters.vendorId ?? null;
  const customerIdOrNull = filters.customerId ?? null;

  const rows = await sql<{
    id: string;
    action: string;
    created_at: string;
    actor_user_id: string | null;
    actor_first: string | null;
    actor_last: string | null;
    actor_email: string | null;
    meta: Record<string, unknown>;
    transaction_id: string | null;
    txn_display_id: string | null;
    txn_consumer_paid_cents: number | null;
    claim_id: string | null;
    claim_display_id: string | null;
    claim_status: string | null;
    claim_created_at: string | null;
    claim_redeemed_at: string | null;
    deal_title: string | null;
    customer_id: string | null;
    customer_first: string | null;
    customer_last: string | null;
    customer_email: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
  }[]>`
    SELECT
      a.id,
      a.action,
      a.created_at,
      a.actor_user_id,
      actor.first_name AS actor_first,
      actor.last_name  AS actor_last,
      actor.email      AS actor_email,
      a.meta,
      a.transaction_id,
      t.display_id            AS txn_display_id,
      t.consumer_paid_cents   AS txn_consumer_paid_cents,
      a.claim_id,
      c.display_id   AS claim_display_id,
      c.status       AS claim_status,
      c.created_at   AS claim_created_at,
      c.redeemed_at  AS claim_redeemed_at,
      (c.snapshot->>'dealTitle') AS deal_title,
      cust.id         AS customer_id,
      cust.first_name AS customer_first,
      cust.last_name  AS customer_last,
      cust.email      AS customer_email,
      a.vendor_id,
      v.business_name AS vendor_name
    FROM public.audit_log a
    LEFT JOIN public.users        actor ON actor.id = a.actor_user_id
    LEFT JOIN public.transactions t     ON t.id = a.transaction_id
    LEFT JOIN public.claims       c     ON c.id = a.claim_id
    LEFT JOIN public.users        cust  ON cust.id = c.user_id
    LEFT JOIN public.vendors      v     ON v.id = a.vendor_id
    WHERE a.action IN ('refund.issued', 'refund.partial', 'refund.refused')
      AND (
        ${outcome}::text IS NULL
        OR (${outcome} = 'succeeded' AND a.action IN ('refund.issued', 'refund.partial'))
        OR (${outcome} = 'refused'   AND a.action = 'refund.refused')
      )
      AND (${vendorIdOrNull}::uuid IS NULL OR a.vendor_id = ${vendorIdOrNull}::uuid)
      AND (${customerIdOrNull}::uuid IS NULL OR c.user_id = ${customerIdOrNull}::uuid)
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => {
    const meta = r.meta ?? {};
    const succeeded = r.action !== 'refund.refused';
    // Successful rows carry amountCents; refused rows carry attemptedAmountCents.
    const amountCents = numFromMeta(meta.amountCents) ?? numFromMeta(meta.attemptedAmountCents) ?? 0;
    const consumerPaidCents = numFromMeta(meta.consumerPaidCents) ?? r.txn_consumer_paid_cents;
    return {
      id: r.id,
      action: r.action as AdminRefundRow['action'],
      succeeded,
      isFullRefund: r.action === 'refund.issued',
      refundedAt: r.created_at,
      actorUserId: r.actor_user_id,
      actorName: joinName(r.actor_first, r.actor_last) ?? r.actor_email ?? null,
      actorEmail: r.actor_email,
      amountCents,
      cumulativeRefundedCents: numFromMeta(meta.cumulativeRefundedCents),
      consumerPaidCents,
      reason: succeeded ? strFromMeta(meta.reason) : strFromMeta(meta.attemptedRefundReason),
      stripeRefundId: strFromMeta(meta.stripeRefundId),
      refusedReason: succeeded ? null : strFromMeta(meta.reason),
      transactionId: r.transaction_id,
      transactionDisplayId: r.txn_display_id,
      claimId: r.claim_id,
      claimDisplayId: r.claim_display_id,
      claimStatus: r.claim_status,
      orderPlacedAt: r.claim_created_at,
      redeemedAt: r.claim_redeemed_at,
      wasRedeemedBeforeRefund: r.claim_redeemed_at != null,
      dealTitle: r.deal_title,
      customerId: r.customer_id,
      customerName: joinName(r.customer_first, r.customer_last) ?? r.customer_email ?? null,
      customerEmail: r.customer_email,
      vendorId: r.vendor_id,
      vendorName: r.vendor_name,
    };
  });
}

function numFromMeta(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function strFromMeta(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
function joinName(first: string | null, last: string | null): string | null {
  const n = [first, last].filter(Boolean).join(' ').trim();
  return n.length > 0 ? n : null;
}

/** Admin sets whether redemption auto-fires a Stripe Transfer for this vendor. See §6b. */
export async function setVendorAutoReleaseOnRedemption(
  sql: Sql,
  vendorId: string,
  enabled: boolean,
): Promise<void> {
  await sql`
    UPDATE public.vendors
    SET auto_release_on_redemption = ${enabled}, updated_at = now()
    WHERE id = ${vendorId}
  `;
}

/**
 * Admin sets whether a LOST dispute auto-reverses this vendor's already-sent
 * transfer (GLO-34). On by default for every vendor. Off → the webhook just
 * flags it for a manual claw-back instead. See §4 Disputes.
 */
export async function setVendorAutoClawbackOnDisputeLost(
  sql: Sql,
  vendorId: string,
  enabled: boolean,
): Promise<void> {
  await sql`
    UPDATE public.vendors
    SET auto_clawback_on_dispute_lost = ${enabled}, updated_at = now()
    WHERE id = ${vendorId}
  `;
}

/** True if the internal user id is in admin_users. */
export async function isAdmin(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM public.admin_users WHERE user_id = ${userId} LIMIT 1
  `;
  return rows.length > 0;
}

/** The two roles an admin can hold. Mirrors the admin_users_role_check constraint. */
export type AdminRole = 'owner' | 'moderator';

/** This admin's role, or null if the user isn't an admin. */
export async function getAdminRole(sql: Sql, userId: string): Promise<AdminRole | null> {
  const rows = await sql<{ role: AdminRole }[]>`
    SELECT role FROM public.admin_users WHERE user_id = ${userId} LIMIT 1
  `;
  return rows[0]?.role ?? null;
}

export interface AdminMember {
  userId: string;
  email: string | null;
  clerkUserId: string | null;
  role: AdminRole;
  createdAt: string;
  /** True for the row matching the caller — the UI disables self-removal. */
  isYou: boolean;
}

/** Everyone with admin access, newest first. `callerUserId` flags the caller's row. */
export async function listAdmins(sql: Sql, callerUserId: string): Promise<AdminMember[]> {
  const rows = await sql<{
    user_id: string;
    email: string | null;
    clerk_user_id: string | null;
    role: AdminRole;
    created_at: string;
  }[]>`
    SELECT a.user_id, u.email, u.clerk_user_id, a.role, a.created_at
    FROM public.admin_users a
    JOIN public.users u ON u.id = a.user_id
    ORDER BY a.created_at ASC
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    clerkUserId: r.clerk_user_id,
    role: r.role,
    createdAt: r.created_at,
    isYou: r.user_id === callerUserId,
  }));
}

/** How many owners exist — used to block removing/demoting the last one. */
export async function countOwners(sql: Sql): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM public.admin_users WHERE role = 'owner'
  `;
  return rows[0]?.n ?? 0;
}

/**
 * Grant admin access by email. The person must already have a Gloē account
 * (have signed in at least once) — we match on users.email. Returns the new
 * member, or throws a tagged Error the router maps to a friendly message.
 */
export async function addAdminByEmail(
  sql: Sql,
  email: string,
  role: AdminRole,
): Promise<{ userId: string }> {
  const users = await sql<{ id: string }[]>`
    SELECT id FROM public.users WHERE lower(email) = lower(${email}) LIMIT 1
  `;
  const user = users[0];
  if (!user) throw new Error('NO_SUCH_USER');

  const existing = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM public.admin_users WHERE user_id = ${user.id} LIMIT 1
  `;
  if (existing.length > 0) throw new Error('ALREADY_ADMIN');

  await sql`
    INSERT INTO public.admin_users (user_id, role) VALUES (${user.id}, ${role})
  `;
  return { userId: user.id };
}

/** Revoke admin access. Caller must ensure last-owner / self guards upstream. */
export async function removeAdmin(sql: Sql, userId: string): Promise<void> {
  await sql`DELETE FROM public.admin_users WHERE user_id = ${userId}`;
}

/** Change an admin's role. Caller must ensure last-owner guard upstream. */
export async function setAdminRole(sql: Sql, userId: string, role: AdminRole): Promise<void> {
  await sql`UPDATE public.admin_users SET role = ${role} WHERE user_id = ${userId}`;
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
      (SELECT COUNT(*)::int FROM public.transactions WHERE status IN ('paid','released','partially_refunded')) AS txn_count,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions WHERE status IN ('paid','released','partially_refunded')),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions WHERE status IN ('paid','released','partially_refunded')),0)::int AS income_cents,
      COALESCE((SELECT SUM(vendor_payout_cents) FROM public.transactions WHERE status IN ('paid','released','partially_refunded')),0)::int AS payout_cents,
      (SELECT COUNT(*)::int FROM public.vendors) AS vendor_count,
      (SELECT COUNT(*)::int FROM public.deals WHERE status='active') AS active_deal_count,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions WHERE status IN ('paid','released','partially_refunded') AND paid_at >= now() - interval '30 days'),0)::int AS income_30d_cents,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions WHERE status IN ('paid','released','partially_refunded') AND paid_at >= now() - interval '30 days'),0)::int AS gross_30d_cents
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
    JOIN public.transactions t ON t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')
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
  // Dispute flag uses the same admin-chosen policy as the vendor detail page.
  const riskCfg = await getDisputeRiskConfig(sql);
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
    dispute_in_window: number;
    created_at: string;
  }[]>`
    SELECT v.id, v.business_name, v.status, v.city,
      (v.owner_user_id IS NOT NULL) AS has_owner,
      v.license_number, v.stripe_account_status, v.google_place_id,
      (SELECT COUNT(*)::int FROM public.deals d WHERE d.vendor_id = v.id) AS deal_count,
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t WHERE t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')),0) AS purchases,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t WHERE t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions t WHERE t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS income_cents,
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t WHERE t.vendor_id = v.id
                AND t.disputed_at IS NOT NULL
                AND t.disputed_at >= now() - (${riskCfg.windowDays} || ' days')::interval),0) AS dispute_in_window,
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
    disputeInWindow: r.dispute_in_window,
    isHighDisputeRisk: riskCfg.enabled && r.dispute_in_window > riskCfg.maxDisputes,
    createdAt: r.created_at,
  }));
}

/** One vendor's profile + all their deals (any status) for the admin detail page. */
export async function getVendorDetail(sql: Sql, vendorId: string) {
  const vRows = await sql<{
    id: string;
    display_id: string;
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
    auto_release_on_redemption: boolean;
    auto_clawback_on_dispute_lost: boolean;
    gloe_take: string | null;
    gloe_perks: string[] | null;
    purchases: number;
    gross_cents: number;
    income_cents: number;
    stripe_fee_cents: number;
  }[]>`
    SELECT v.id, v.display_id, v.business_name, v.status, v.city, v.region, v.address_line1, v.phone,
      (v.owner_user_id IS NOT NULL) AS has_owner, v.admin_bypass,
      v.stripe_account_status, v.google_place_id, v.auto_release_on_redemption,
      v.auto_clawback_on_dispute_lost,
      v.gloe_take, v.gloe_perks,
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t WHERE t.vendor_id=v.id AND t.status IN ('paid','released','partially_refunded')),0) AS purchases,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t WHERE t.vendor_id=v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions t WHERE t.vendor_id=v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS income_cents,
      COALESCE((SELECT SUM(stripe_fee_cents)   FROM public.transactions t WHERE t.vendor_id=v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS stripe_fee_cents
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

  // Dispute scorecard (GLO-34). A "dispute" = any transaction that ever had a
  // chargeback opened (disputed_at set), regardless of how it later resolved.
  // We measure the count over the admin-chosen window and flag against the
  // admin-chosen threshold — both live in platform_settings, not in code.
  const riskCfg = await getDisputeRiskConfig(sql);
  const disputeAgg = await sql<{
    total: number;
    in_window: number;
    lost: number;
    open: number;
    last_disputed_at: string | null;
  }[]>`
    SELECT
      COUNT(*) FILTER (WHERE disputed_at IS NOT NULL)::int AS total,
      COUNT(*) FILTER (WHERE disputed_at IS NOT NULL
                         AND disputed_at >= now() - (${riskCfg.windowDays} || ' days')::interval)::int AS in_window,
      COUNT(*) FILTER (WHERE dispute_status IN ('lost','charge_refunded'))::int AS lost,
      COUNT(*) FILTER (WHERE status = 'disputed')::int AS open,
      MAX(disputed_at) AS last_disputed_at
    FROM public.transactions
    WHERE vendor_id = ${vendorId}
  `;
  const da = disputeAgg[0]!;
  // Rate over the vendor's whole life (disputes ÷ paid orders). purchases counts
  // paid/released/partially_refunded; a disputed txn leaves that set, so add
  // disputes back into the denominator to keep the rate honest.
  const disputeDenom = v.purchases + da.total;
  const disputeRate = disputeDenom > 0 ? da.total / disputeDenom : 0;
  const isHighDisputeRisk = riskCfg.enabled && da.in_window > riskCfg.maxDisputes;

  const heldRows = await sql<{
    claim_id: string;
    transaction_id: string;
    vendor_payout_cents: number;
    deal_title: string | null;
    redeemed_at: string;
  }[]>`
    SELECT
      c.id                  AS claim_id,
      t.id                  AS transaction_id,
      t.vendor_payout_cents AS vendor_payout_cents,
      d.title               AS deal_title,
      c.redeemed_at         AS redeemed_at
    FROM public.claims c
    JOIN public.transactions t ON t.id = c.transaction_id
    LEFT JOIN public.deals d   ON d.id = c.deal_id
    WHERE c.vendor_id          = ${vendorId}
      AND c.status             = 'redeemed'
      AND t.status             = 'paid'
      AND t.stripe_transfer_id IS NULL
    ORDER BY c.redeemed_at DESC
  `;

  // Every transfer that has fired for this vendor — for "where's my money?" support
  // calls. We never delete rows from `transactions`, so this is the full history.
  const releases = await sql<{
    transaction_id: string;
    transaction_display_id: string;
    amount_cents: number;
    deal_title: string | null;
    customer_email: string | null;
    stripe_transfer_id: string;
    released_at: string;
  }[]>`
    SELECT
      t.id                  AS transaction_id,
      t.display_id          AS transaction_display_id,
      t.vendor_payout_cents AS amount_cents,
      d.title               AS deal_title,
      u.email               AS customer_email,
      t.stripe_transfer_id  AS stripe_transfer_id,
      t.released_at         AS released_at
    FROM public.transactions t
    LEFT JOIN public.claims c ON c.transaction_id = t.id
    LEFT JOIN public.deals d  ON d.id = c.deal_id
    LEFT JOIN public.users u  ON u.id = t.user_id
    WHERE t.vendor_id           = ${vendorId}
      AND t.stripe_transfer_id IS NOT NULL
    ORDER BY t.released_at DESC NULLS LAST
    LIMIT 100
  `;

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
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t JOIN public.claims cl ON cl.transaction_id=t.id
                WHERE cl.deal_id=d.id AND t.status IN ('paid','released','partially_refunded')),0) AS purchases
    FROM public.deals d
    JOIN public.service_categories c ON c.id = d.category_id
    WHERE d.vendor_id = ${vendorId}
    ORDER BY d.created_at DESC
  `;

  return {
    vendor: {
      id: v.id,
      displayId: v.display_id,
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
      stripeFeeCents: v.stripe_fee_cents,
      // Net we actually keep after Stripe's processing fee comes out of our cut.
      netIncomeCents: v.income_cents - v.stripe_fee_cents,
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
      autoReleaseOnRedemption: v.auto_release_on_redemption,
      autoClawbackOnDisputeLost: v.auto_clawback_on_dispute_lost,
      gloeTake: v.gloe_take,
      gloePerks: v.gloe_perks ?? [],
      // Dispute scorecard + the policy it was judged against (so the UI can
      // explain "5 in 90d — over your limit of 2").
      disputeTotal: da.total,
      disputeInWindow: da.in_window,
      disputeLost: da.lost,
      disputeOpen: da.open,
      disputeRate, // 0..1, disputes ÷ (paid orders + disputes)
      lastDisputedAt: da.last_disputed_at,
      isHighDisputeRisk,
      disputeRiskConfig: riskCfg, // { enabled, maxDisputes, windowDays }
    },
    heldPayouts: heldRows.map((r) => ({
      claimId: r.claim_id,
      transactionId: r.transaction_id,
      amountCents: r.vendor_payout_cents,
      dealTitle: r.deal_title,
      redeemedAt: r.redeemed_at,
    })),
    releases: releases.map((r) => ({
      transactionId: r.transaction_id,
      transactionDisplayId: r.transaction_display_id,
      amountCents: r.amount_cents,
      dealTitle: r.deal_title,
      customerEmail: r.customer_email,
      stripeTransferId: r.stripe_transfer_id,
      releasedAt: r.released_at,
    })),
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
  decision: 'approve' | 'reject' | 'request_changes',
  reason?: string | null,
) {
  if (decision === 'approve') {
    await sql`
      UPDATE public.deals
      SET status = 'active', approved_at = now(), rejection_reason = NULL
      WHERE id = ${dealId} AND status = 'pending_review'
    `;
  } else if (decision === 'request_changes') {
    // Soft bounce: send it back to the vendor as a draft with feedback so they
    // can fix it and resubmit. Distinct from a hard reject (which kills it).
    await sql`
      UPDATE public.deals
      SET status = 'draft', rejection_reason = ${reason ?? null}
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
    WHERE t.status IN ('paid','released','partially_refunded')
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

/* ============================================================
 * Support tickets (god mode) — consumer ↔ Gloē. The consumer side
 * lives in domain/supportTickets.ts; admin sees ALL tickets and is the
 * only place an agent reply (and its push) is produced.
 * ============================================================ */

export async function listAdminSupportTickets(
  sql: Sql,
  filters: { query?: string; status?: string; limit?: number },
) {
  const queryLike =
    filters.query && filters.query.trim().length >= 2 ? `%${filters.query.trim()}%` : null;
  const status = filters.status ?? null;
  const limit = Math.min(filters.limit ?? 200, 200);
  const rows = await sql<{
    id: string;
    subject: string;
    category: string | null;
    status: string;
    last_message_at: string;
    created_at: string;
    user_id: string;
    customer_name: string | null;
    customer_email: string | null;
    message_count: number;
    unread_from_customer: number;
  }[]>`
    SELECT
      st.id, st.subject, st.category, st.status, st.last_message_at, st.created_at, st.user_id,
      NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS customer_name,
      u.email AS customer_email,
      (SELECT COUNT(*) FROM public.support_messages m WHERE m.ticket_id = st.id)::int AS message_count,
      (SELECT COUNT(*) FROM public.support_messages m
         WHERE m.ticket_id = st.id AND m.sender_type = 'customer')::int AS unread_from_customer
    FROM public.support_tickets st
    LEFT JOIN public.users u ON u.id = st.user_id
    WHERE (${status}::text IS NULL OR st.status = ${status})
      AND (${queryLike}::text IS NULL
           OR st.subject ILIKE ${queryLike}
           OR u.email ILIKE ${queryLike}
           OR u.first_name ILIKE ${queryLike}
           OR u.last_name ILIKE ${queryLike})
    ORDER BY (st.status = 'awaiting_us') DESC, st.last_message_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    category: r.category,
    status: r.status,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
    userId: r.user_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    messageCount: r.message_count,
    unreadFromCustomer: r.unread_from_customer,
  }));
}

export async function getAdminSupportTicketDetail(sql: Sql, id: string) {
  const ticketRows = await sql<{
    id: string;
    subject: string;
    category: string | null;
    status: string;
    last_message_at: string;
    created_at: string;
    resolved_at: string | null;
    user_id: string;
    customer_name: string | null;
    customer_email: string | null;
  }[]>`
    SELECT
      st.id, st.subject, st.category, st.status, st.last_message_at, st.created_at, st.resolved_at, st.user_id,
      NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '') AS customer_name,
      u.email AS customer_email
    FROM public.support_tickets st
    LEFT JOIN public.users u ON u.id = st.user_id
    WHERE st.id = ${id}
    LIMIT 1
  `;
  const t = ticketRows[0];
  if (!t) throw new Error('Support ticket not found');

  const messages = await sql<{
    id: string;
    sender_type: string;
    sender_user_id: string | null;
    body: string;
    read_at: string | null;
    created_at: string;
  }[]>`
    SELECT id, sender_type, sender_user_id, body, read_at, created_at
    FROM public.support_messages
    WHERE ticket_id = ${id}
    ORDER BY created_at ASC
  `;

  const byMessage = await attachmentsForMessages(sql, messages.map((m) => m.id));

  return {
    ticket: {
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      lastMessageAt: t.last_message_at,
      createdAt: t.created_at,
      resolvedAt: t.resolved_at,
      userId: t.user_id,
      customerName: t.customer_name,
      customerEmail: t.customer_email,
    },
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.sender_type,
      senderUserId: m.sender_user_id,
      body: m.body,
      readAt: m.read_at,
      createdAt: m.created_at,
      attachments: byMessage.get(m.id) ?? [],
    })),
  };
}

/**
 * Agent reply. The ONLY place a push to the customer fires. Inserts the agent
 * message, transitions the ticket to awaiting_customer, then fire-and-forgets
 * an APNs push (never blocks the founder's reply latency on Apple).
 */
export async function createAgentReply(
  sql: Sql,
  ticketId: string,
  body: string,
  adminUserId: string,
  attachments?: AttachmentInput[],
) {
  const ticketRows = await sql<{ user_id: string; subject: string }[]>`
    SELECT user_id, subject FROM public.support_tickets WHERE id = ${ticketId} LIMIT 1
  `;
  const ticket = ticketRows[0];
  if (!ticket) throw new Error('Support ticket not found');

  const insertedAgent = await sql<{ id: string }[]>`
    INSERT INTO public.support_messages (ticket_id, sender_type, sender_user_id, body)
    VALUES (${ticketId}, 'agent', ${adminUserId}, ${body})
    RETURNING id
  `;
  await insertAttachments(sql, insertedAgent[0]!.id, attachments ?? []);

  await sql`
    UPDATE public.support_tickets
    SET status = 'awaiting_customer', last_message_at = now(), updated_at = now()
    WHERE id = ${ticketId}
  `;

  // Fire-and-forget push to the customer, via the notification registry
  // (admin-toggleable in notification_types). No-ops if disabled or APNs unconfigured.
  const { sendNotification } = await import('./notifications');
  void sendNotification(sql, 'support_reply', ticket.user_id, {
    vars: { body: body.slice(0, 120) },
    data: { type: 'support_reply', ticketId },
  });

  return { ok: true as const };
}

/**
 * Resolve / close / reopen a ticket. Writes a 'system' message documenting the
 * transition (audit trail in-thread). Sets resolved_at on resolve.
 */
export async function setSupportTicketStatus(
  sql: Sql,
  ticketId: string,
  status: 'awaiting_us' | 'awaiting_customer' | 'resolved' | 'closed',
  adminUserId: string,
) {
  const ticketRows = await sql<{ id: string }[]>`
    SELECT id FROM public.support_tickets WHERE id = ${ticketId} LIMIT 1
  `;
  if (!ticketRows[0]) throw new Error('Support ticket not found');

  await sql`
    UPDATE public.support_tickets
    SET status = ${status},
        resolved_at = ${status === 'resolved' ? sql`now()` : sql`NULL`},
        updated_at = now()
    WHERE id = ${ticketId}
  `;
  await sql`
    INSERT INTO public.support_messages (ticket_id, sender_type, sender_user_id, body)
    VALUES (${ticketId}, 'system', ${adminUserId}, ${`Ticket marked ${status.replace('_', ' ')}.`})
  `;
  return { ok: true as const };
}
