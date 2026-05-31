import type { Sql } from '../db/client';

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
  };
}

/* ─────────────── create ─────────────── */

export interface CreateTicketInput {
  subject: string;
  category?: TicketCategory | null;
  body: string;
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

  const ticketRows = await sql<{ id: string }[]>`
    INSERT INTO public.support_tickets (user_id, subject, category, status, last_message_at)
    VALUES (${userId}, ${subject}, ${category}, 'awaiting_us', now())
    RETURNING id
  `;
  const ticketId = ticketRows[0]!.id;

  await sql`
    INSERT INTO public.support_messages (ticket_id, sender_type, sender_user_id, body)
    VALUES (${ticketId}, 'customer', ${userId}, ${body})
  `;

  return { id: ticketId };
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

  return {
    ticket: mapTicket(ticketRows[0]!),
    messages: messageRows.map(mapMessage),
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

  await sql`
    UPDATE public.support_tickets
    SET status = ${next},
        resolved_at = ${clearResolvedAt ? sql`NULL` : sql`resolved_at`},
        last_message_at = now(),
        updated_at = now()
    WHERE id = ${ticketId} AND user_id = ${userId}
  `;

  return mapMessage(inserted[0]!);
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
