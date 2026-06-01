import type { Sql } from '../db/client';
import {
  insertAttachments,
  attachmentsForMessages,
  type AttachmentInput,
  type Attachment,
} from './supportAttachments';

/**
 * Consumer-side support tickets.
 *
 * One thread per ticket; a ticket holds many messages. Customers open tickets
 * from the app, agents reply from the web admin console. A 5-state machine
 * tracks whose turn it is so both sides know who's waiting on whom:
 *
 *   open             — just created, not yet triaged (initial admin-side default)
 *   awaiting_us      — customer sent the last message; the ball is in our court
 *   awaiting_customer— agent replied; waiting on the customer
 *   resolved         — agent marked it done (soft-closed, customer can reopen)
 *   closed           — fully closed (customer or agent); customer reply reopens
 *
 * Every consumer function filters by user_id in the SQL itself — never trust a
 * client-supplied ticket id without re-checking ownership (IDOR guard).
 */

/* ─────────────── state machine ─────────────── */

export type TicketStatus =
  | 'open'
  | 'awaiting_us'
  | 'awaiting_customer'
  | 'resolved'
  | 'closed';

/**
 * The one place the consumer-side status transitions live. Given the current
 * status and who just acted, return the next status and whether resolved_at
 * should be cleared (i.e. we're reopening a previously-resolved ticket).
 */
function applyTransition(
  current: TicketStatus,
  actor: 'customer',
): { next: TicketStatus; clearResolvedAt: boolean } {
  // A customer message always pulls the ball back into our court. If the
  // ticket was resolved or closed, this reopens it — clear resolved_at.
  if (actor === 'customer') {
    const reopening = current === 'resolved' || current === 'closed';
    return { next: 'awaiting_us', clearResolvedAt: reopening };
  }
  return { next: current, clearResolvedAt: false };
}

/** Truncate a message body for list previews. */
const PREVIEW_LEN = 120;
function previewOf(body: string | null): string {
  if (!body) return '';
  const trimmed = body.replace(/\s+/g, ' ').trim();
  return trimmed.length > PREVIEW_LEN ? `${trimmed.slice(0, PREVIEW_LEN - 1)}…` : trimmed;
}

/* ─────────────── shapes ─────────────── */

export type TicketCategory =
  | 'refund'
  | 'voucher'
  | 'payment'
  | 'account'
  | 'vendor'
  | 'other';

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  category: TicketCategory | null;
  status: TicketStatus;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface SupportTicketListItem extends SupportTicket {
  lastMessagePreview: string;
  unreadCount: number;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderUserId: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
  attachments: Attachment[];
}

function mapTicket(r: {
  id: string;
  user_id: string;
  subject: string;
  category: TicketCategory | null;
  status: TicketStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}): SupportTicket {
  return {
    id: r.id,
    userId: r.user_id,
    subject: r.subject,
    category: r.category,
    status: r.status,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
  };
}

function mapMessage(r: {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'agent' | 'system';
  sender_user_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}): SupportMessage {
  return {
    id: r.id,
    ticketId: r.ticket_id,
    senderType: r.sender_type,
    senderUserId: r.sender_user_id,
    body: r.body,
    readAt: r.read_at,
    createdAt: r.created_at,
    attachments: [],
  };
}

/* ─────────────── create ─────────────── */

export interface CreateTicketInput {
  subject: string;
  category?: TicketCategory | null;
  body: string;
  attachments?: AttachmentInput[];
  /** Optional: the voucher/order this ticket is about, so god-mode knows. */
  claimId?: string | null;
}

/**
 * Open a new ticket plus its first customer message. The ticket starts in
 * 'awaiting_us' (the customer just wrote, so the ball is in our court) and
 * stamps last_message_at = now(). Returns the new ticket id.
 */
export async function createTicket(
  sql: Sql,
  userId: string,
  input: CreateTicketInput,
): Promise<{ id: string }> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  const category = input.category ?? null;
  const claimId = input.claimId ?? null;

  // Both inserts in ONE round-trip via a CTE — the ticket insert feeds the
  // message insert. Halves the DB latency on this hot path (every saved second
  // matters when the DB is a round-trip away). We RETURN the first message id
  // too so any attachments can be hung off it without re-querying.
  // claim_id is only kept if it's actually the customer's claim (IDOR guard in SQL).
  const rows = await sql<{ id: string; message_id: string }[]>`
    WITH owned_claim AS (
      SELECT id FROM public.claims WHERE id = ${claimId} AND user_id = ${userId}
    ),
    new_ticket AS (
      INSERT INTO public.support_tickets (user_id, subject, category, status, last_message_at, claim_id)
      VALUES (${userId}, ${subject}, ${category}, 'awaiting_us', now(), (SELECT id FROM owned_claim))
      RETURNING id
    ),
    first_message AS (
      INSERT INTO public.support_messages (ticket_id, sender_type, sender_user_id, body)
      SELECT id, 'customer', ${userId}, ${body} FROM new_ticket
      RETURNING id, ticket_id
    )
    SELECT new_ticket.id, first_message.id AS message_id
    FROM new_ticket, first_message
  `;

  // Persist any attachments against the first message (no-op when empty).
  await insertAttachments(sql, rows[0]!.message_id, input.attachments ?? []);

  return { id: rows[0]!.id };
}

/* ─────────────── list ─────────────── */

/**
 * Every ticket for a user, newest activity first. Each row carries a truncated
 * preview of the latest message and a count of unread agent/system replies so
 * the inbox can show "you have N new replies" without a second round-trip.
 */
export async function listTicketsForUser(
  sql: Sql,
  userId: string,
): Promise<SupportTicketListItem[]> {
  const rows = await sql<{
    id: string;
    user_id: string;
    subject: string;
    category: TicketCategory | null;
    status: TicketStatus;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    last_message_body: string | null;
    unread_count: number;
  }[]>`
    SELECT
      t.id,
      t.user_id,
      t.subject,
      t.category,
      t.status,
      t.last_message_at,
      t.created_at,
      t.updated_at,
      t.resolved_at,
      (SELECT m.body FROM public.support_messages m
        WHERE m.ticket_id = t.id
        ORDER BY m.created_at DESC
        LIMIT 1) AS last_message_body,
      (SELECT COUNT(*)::int FROM public.support_messages m
        WHERE m.ticket_id = t.id
          AND m.sender_type IN ('agent', 'system')
          AND m.read_at IS NULL) AS unread_count
    FROM public.support_tickets t
    WHERE t.user_id = ${userId}
    ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
  `;
  return rows.map((r) => ({
    ...mapTicket(r),
    lastMessagePreview: previewOf(r.last_message_body),
    unreadCount: r.unread_count,
  }));
}

/* ─────────────── detail ─────────────── */

/**
 * A single ticket plus its full message thread, oldest message first. The
 * user_id = userId filter is re-checked in SQL (IDOR guard); a missing or
 * not-owned ticket throws NOT_FOUND.
 */
export async function getTicketWithMessages(
  sql: Sql,
  userId: string,
  id: string,
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
  const ticketRows = await sql<{
    id: string;
    user_id: string;
    subject: string;
    category: TicketCategory | null;
    status: TicketStatus;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  }[]>`
    SELECT id, user_id, subject, category, status, last_message_at, created_at, updated_at, resolved_at
    FROM public.support_tickets
    WHERE id = ${id} AND user_id = ${userId}
  `;
  if (ticketRows.length === 0) throw new Error('NOT_FOUND');

  const messageRows = await sql<{
    id: string;
    ticket_id: string;
    sender_type: 'customer' | 'agent' | 'system';
    sender_user_id: string | null;
    body: string;
    read_at: string | null;
    created_at: string;
  }[]>`
    SELECT id, ticket_id, sender_type, sender_user_id, body, read_at, created_at
    FROM public.support_messages
    WHERE ticket_id = ${id}
    ORDER BY created_at ASC
  `;

  const byMessage = await attachmentsForMessages(sql, messageRows.map((m) => m.id));
  return {
    ticket: mapTicket(ticketRows[0]!),
    messages: messageRows.map((m) => ({
      ...mapMessage(m),
      attachments: byMessage.get(m.id) ?? [],
    })),
  };
}

/* ─────────────── customer reply ─────────────── */

/**
 * Append a customer message to a ticket they own. Ownership is enforced in the
 * SQL itself (no row → NOT_FOUND). Inserting transitions the ticket to
 * 'awaiting_us' and — if it had been resolved or closed — reopens it by
 * clearing resolved_at. last_message_at and updated_at are bumped to now().
 */
export async function addCustomerMessage(
  sql: Sql,
  userId: string,
  ticketId: string,
  body: string,
  attachments?: AttachmentInput[],
): Promise<SupportMessage> {
  const ownerRows = await sql<{ status: TicketStatus }[]>`
    SELECT status FROM public.support_tickets
    WHERE id = ${ticketId} AND user_id = ${userId}
  `;
  if (ownerRows.length === 0) throw new Error('NOT_FOUND');

  const { next, clearResolvedAt } = applyTransition(ownerRows[0]!.status, 'customer');
  const trimmed = body.trim();

  const inserted = await sql<{
    id: string;
    ticket_id: string;
    sender_type: 'customer' | 'agent' | 'system';
    sender_user_id: string | null;
    body: string;
    read_at: string | null;
    created_at: string;
  }[]>`
    INSERT INTO public.support_messages (ticket_id, sender_type, sender_user_id, body)
    VALUES (${ticketId}, 'customer', ${userId}, ${trimmed})
    RETURNING id, ticket_id, sender_type, sender_user_id, body, read_at, created_at
  `;

  // Persist any attachments against the just-inserted message (no-op if none).
  await insertAttachments(sql, inserted[0]!.id, attachments ?? []);

  await sql`
    UPDATE public.support_tickets
    SET status = ${next},
        resolved_at = ${clearResolvedAt ? sql`NULL` : sql`resolved_at`},
        last_message_at = now(),
        updated_at = now()
    WHERE id = ${ticketId} AND user_id = ${userId}
  `;

  // Re-read so the returned attachments carry their DB-generated ids (clients
  // key on attachment.id). Mirrors review_photos round-tripping the saved rows.
  const byMessage = await attachmentsForMessages(sql, [inserted[0]!.id]);
  return { ...mapMessage(inserted[0]!), attachments: byMessage.get(inserted[0]!.id) ?? [] };
}

/* ─────────────── read receipts ─────────────── */

/**
 * Mark every unread agent/system message on an owned ticket as read. The
 * ownership EXISTS subquery keeps a foreign ticket id from clearing someone
 * else's unread badges. Returns how many rows were marked.
 */
export async function markAgentMessagesRead(
  sql: Sql,
  userId: string,
  ticketId: string,
): Promise<{ marked: number }> {
  const rows = await sql<{ id: string }[]>`
    UPDATE public.support_messages m
    SET read_at = now()
    WHERE m.ticket_id = ${ticketId}
      AND m.sender_type IN ('agent', 'system')
      AND m.read_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = m.ticket_id AND t.user_id = ${userId}
      )
    RETURNING m.id
  `;
  return { marked: rows.length };
}

/* ─────────────── unread badge ─────────────── */

/** Total unread agent/system messages across all of a user's tickets. */
export async function countUnreadForUser(sql: Sql, userId: string): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM public.support_messages m
    JOIN public.support_tickets t ON t.id = m.ticket_id
    WHERE t.user_id = ${userId}
      AND m.sender_type IN ('agent', 'system')
      AND m.read_at IS NULL
  `;
  return rows[0]?.count ?? 0;
}

/* ─────────────── customer close ─────────────── */

/**
 * Customer closes their own ticket ("never mind, sorted it"). Ownership is
 * enforced in SQL; a foreign id throws NOT_FOUND. A later customer message
 * reopens it via addCustomerMessage.
 */
export async function customerCloseTicket(
  sql: Sql,
  userId: string,
  ticketId: string,
): Promise<SupportTicket> {
  const rows = await sql<{
    id: string;
    user_id: string;
    subject: string;
    category: TicketCategory | null;
    status: TicketStatus;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  }[]>`
    UPDATE public.support_tickets
    SET status = 'closed', updated_at = now()
    WHERE id = ${ticketId} AND user_id = ${userId}
    RETURNING id, user_id, subject, category, status, last_message_at, created_at, updated_at, resolved_at
  `;
  if (rows.length === 0) throw new Error('NOT_FOUND');
  return mapTicket(rows[0]!);
}

/* ─────────────── orders (for ticket context) ─────────────── */

export interface CustomerOrder {
  claimId: string;
  transactionId: string | null;
  dealTitle: string;
  vendorName: string;
  consumerPaidCents: number;
  refundedCents: number;
  txnStatus: string | null;
  claimStatus: string; // active / redeemed / expired / cancelled
  purchasedAt: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
}

/**
 * Map a claims+transactions row to a CustomerOrder. Shared by the consumer
 * picker (their own orders) and the god-mode ticket drawer (the ticket owner's
 * orders). Reads the frozen claim snapshot for title/vendor so it's accurate
 * even if the deal later changes.
 */
// Bound the result set — even a power user's history stays renderable. Recency
// + optional text search (deal title / vendor name in the frozen snapshot)
// covers "find the order this ticket is about" without server pagination.
const ORDERS_LIMIT = 50;

function ordersQuery(sql: Sql, userId: string, search?: string) {
  const like = search && search.trim().length >= 2 ? `%${search.trim()}%` : null;
  return sql<{
    claim_id: string;
    transaction_id: string | null;
    deal_title: string | null;
    vendor_name: string | null;
    consumer_paid_cents: number | null;
    refunded_cents: number | null;
    txn_status: string | null;
    claim_status: string;
    purchased_at: string | null;
    redeemed_at: string | null;
    expires_at: string | null;
  }[]>`
    SELECT
      c.id AS claim_id,
      c.transaction_id,
      (c.snapshot ->> 'dealTitle') AS deal_title,
      (c.snapshot ->> 'vendorName') AS vendor_name,
      t.consumer_paid_cents,
      t.refunded_cents,
      t.status AS txn_status,
      c.status AS claim_status,
      COALESCE(t.paid_at, c.created_at) AS purchased_at,
      c.redeemed_at,
      c.expires_at
    FROM public.claims c
    LEFT JOIN public.transactions t ON t.id = c.transaction_id
    WHERE c.user_id = ${userId}
      AND (${like}::text IS NULL
           OR (c.snapshot ->> 'dealTitle') ILIKE ${like}
           OR (c.snapshot ->> 'vendorName') ILIKE ${like})
    ORDER BY COALESCE(t.paid_at, c.created_at) DESC
    LIMIT ${ORDERS_LIMIT}
  `;
}

function mapOrder(r: {
  claim_id: string;
  transaction_id: string | null;
  deal_title: string | null;
  vendor_name: string | null;
  consumer_paid_cents: number | null;
  refunded_cents: number | null;
  txn_status: string | null;
  claim_status: string;
  purchased_at: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
}): CustomerOrder {
  return {
    claimId: r.claim_id,
    transactionId: r.transaction_id,
    dealTitle: r.deal_title ?? 'Deal',
    vendorName: r.vendor_name ?? '',
    consumerPaidCents: r.consumer_paid_cents ?? 0,
    refundedCents: r.refunded_cents ?? 0,
    txnStatus: r.txn_status,
    claimStatus: r.claim_status,
    purchasedAt: r.purchased_at,
    redeemedAt: r.redeemed_at,
    expiresAt: r.expires_at,
  };
}

/** Consumer: the signed-in user's own orders, for the "which order?" picker. */
export async function listMyOrders(sql: Sql, userId: string, search?: string): Promise<CustomerOrder[]> {
  const rows = await ordersQuery(sql, userId, search);
  return rows.map(mapOrder);
}

/** Admin: a ticket's customer's orders (recency-capped, searchable). The
 * tagged order is always returned even if outside the recent window/search. */
export async function getCustomerOrdersForTicket(
  sql: Sql,
  ticketId: string,
  search?: string,
): Promise<{ orders: CustomerOrder[]; linkedClaimId: string | null }> {
  const owner = await sql<{ user_id: string; claim_id: string | null }[]>`
    SELECT user_id, claim_id FROM public.support_tickets WHERE id = ${ticketId} LIMIT 1
  `;
  if (owner.length === 0) throw new Error('NOT_FOUND');
  const linkedClaimId = owner[0]!.claim_id;
  const rows = await ordersQuery(sql, owner[0]!.user_id, search);
  let orders = rows.map(mapOrder);

  // Guarantee the tagged order is present even if it's older than the recent
  // window or doesn't match the search — the agent must always see the order
  // the customer flagged.
  if (linkedClaimId && !orders.some((o) => o.claimId === linkedClaimId)) {
    const tagged = (await ordersQuery(sql, owner[0]!.user_id)).map(mapOrder).find((o) => o.claimId === linkedClaimId);
    if (tagged) orders = [tagged, ...orders];
  }
  return { orders, linkedClaimId };
}

/* ─────────────── customer boss-view (for the support drawer) ─────────────── */

export interface SupportTicketCustomer {
  userId: string;
  displayId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  imageUrl: string | null;
  city: string | null;
  memberSince: string;
  // Money
  lifetimePaidCents: number;
  refundedCents: number;
  purchaseCount: number;
  redemptionCount: number;
  // Activity
  lastPurchaseAt: string | null;
  ticketCount: number;        // total support tickets this customer has opened
  openTicketCount: number;    // currently open (not resolved/closed)
}

/**
 * Rich customer profile for the god-mode support drawer header. One query each
 * for identity / money / activity so the agent sees who they're dealing with —
 * whale vs refund-farmer vs first-timer — before they reply. Keyed off the
 * ticket's owner.
 */
export async function getSupportTicketCustomer(
  sql: Sql,
  ticketId: string,
): Promise<SupportTicketCustomer> {
  const owner = await sql<{ user_id: string }[]>`
    SELECT user_id FROM public.support_tickets WHERE id = ${ticketId} LIMIT 1
  `;
  if (owner.length === 0) throw new Error('NOT_FOUND');
  const userId = owner[0]!.user_id;

  const rows = await sql<{
    display_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    image_url: string | null;
    selected_city: string | null;
    created_at: string;
    lifetime_paid_cents: number;
    refunded_cents: number;
    purchase_count: number;
    redemption_count: number;
    last_purchase_at: string | null;
    ticket_count: number;
    open_ticket_count: number;
  }[]>`
    SELECT
      u.display_id, u.first_name, u.last_name, u.email, u.phone, u.image_url, u.selected_city, u.created_at,
      COALESCE((SELECT SUM(consumer_paid_cents) FROM public.transactions t
                WHERE t.user_id = u.id AND t.status IN ('paid','released','partially_refunded')), 0)::int AS lifetime_paid_cents,
      COALESCE((SELECT SUM(refunded_cents) FROM public.transactions t
                WHERE t.user_id = u.id), 0)::int AS refunded_cents,
      COALESCE((SELECT COUNT(*) FROM public.transactions t
                WHERE t.user_id = u.id AND t.status IN ('paid','released','partially_refunded')), 0)::int AS purchase_count,
      COALESCE((SELECT COUNT(*) FROM public.claims c
                WHERE c.user_id = u.id AND c.status = 'redeemed'), 0)::int AS redemption_count,
      (SELECT MAX(t.paid_at) FROM public.transactions t WHERE t.user_id = u.id) AS last_purchase_at,
      COALESCE((SELECT COUNT(*) FROM public.support_tickets st WHERE st.user_id = u.id), 0)::int AS ticket_count,
      COALESCE((SELECT COUNT(*) FROM public.support_tickets st
                WHERE st.user_id = u.id AND st.status NOT IN ('resolved','closed')), 0)::int AS open_ticket_count
    FROM public.users u
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) throw new Error('NOT_FOUND');

  const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || null;
  return {
    userId,
    displayId: r.display_id,
    name,
    email: r.email,
    phone: r.phone,
    imageUrl: r.image_url,
    city: r.selected_city,
    memberSince: r.created_at,
    lifetimePaidCents: r.lifetime_paid_cents,
    refundedCents: r.refunded_cents,
    purchaseCount: r.purchase_count,
    redemptionCount: r.redemption_count,
    lastPurchaseAt: r.last_purchase_at,
    ticketCount: r.ticket_count,
    openTicketCount: r.open_ticket_count,
  };
}
