import type { Sql } from '../db/client';

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
    sql<{ id: string; title: string; business_name: string }[]>`
      SELECT d.id, d.title, v.business_name
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
      // Customers tab is a Session 2 build — fallback to a search-prefilled link for now.
      href: `/admin?q=${encodeURIComponent(name)}`,
    });
  }
  for (const t of transactions) {
    hits.push({
      kind: 'transaction',
      id: t.id,
      title: `$${(t.consumer_paid_cents / 100).toFixed(2)} · ${t.business_name}`,
      subtitle: `${t.status} · ${t.stripe_payment_intent_id ?? t.id.slice(0, 8)}`,
      href: `/admin?tx=${t.id}`,
    });
  }
  for (const d of deals) {
    hits.push({
      kind: 'deal',
      id: d.id,
      title: d.title,
      subtitle: d.business_name,
      // Deal detail lives in vendor page; jump there + future-deal-detail-anchor.
      href: `/admin/vendor/${d.id}`,
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
  query?: string;
  limit?: number;
}

export async function listAdminTransactions(sql: Sql, filters: TransactionListFilters) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const statuses = (filters.status && filters.status.length > 0)
    ? filters.status
    : ['paid', 'released', 'partially_refunded', 'refunded', 'pending_payment', 'failed', 'disputed'];
  const sinceClause = filters.since ?? '1970-01-01';
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
      t.stripe_payment_intent_id, t.stripe_transfer_id, t.paid_at, t.created_at,
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
    createdAt: r.created_at,
    vendorId: r.vendor_id,
    vendorName: r.business_name,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    claimStatus: r.claim_status,
  }));
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
    vendor_name: string;
    claim_status: string | null;
    deal_title: string | null;
  }[]>`
    SELECT
      t.id, t.display_id, t.status, t.consumer_paid_cents, t.refunded_cents, t.paid_at, t.created_at,
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
      COALESCE((SELECT COUNT(*)::int FROM public.transactions t WHERE t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')),0) AS purchases,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t WHERE t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS gross_cents,
      COALESCE((SELECT SUM(platform_fee_cents) FROM public.transactions t WHERE t.vendor_id = v.id AND t.status IN ('paid','released','partially_refunded')),0)::int AS income_cents,
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
    purchases: number;
    gross_cents: number;
    income_cents: number;
    stripe_fee_cents: number;
  }[]>`
    SELECT v.id, v.display_id, v.business_name, v.status, v.city, v.region, v.address_line1, v.phone,
      (v.owner_user_id IS NOT NULL) AS has_owner, v.admin_bypass,
      v.stripe_account_status, v.google_place_id, v.auto_release_on_redemption,
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
