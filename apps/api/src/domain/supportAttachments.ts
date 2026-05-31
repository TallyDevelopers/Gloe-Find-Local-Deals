import type { Sql } from '../db/client';

/**
 * Photo/video attachments on support-ticket messages.
 *
 * Each message in a support thread can carry an ordered list of media — images
 * or videos uploaded to the 'support-attachments' bucket. Rows live in
 * public.support_message_attachments (message_id FK ON DELETE CASCADE), so
 * deleting a message takes its attachments with it.
 *
 * Mirrors the review_photos pattern in domain/reviews.ts: insert in a loop with
 * display_order = index after the parent insert, and batch-fetch for a page of
 * messages in ONE query to avoid N+1.
 */

/** What the client sends up after uploading to the bucket (camelCase). */
export interface AttachmentInput {
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

/** What every message carries back out, per attachment (camelCase). */
export interface Attachment {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

/**
 * Persist a message's attachments, preserving order. display_order = index, so
 * the array order the client sent is the order it renders in. No-op on empty —
 * avoids a pointless round-trip for text-only messages.
 */
export async function insertAttachments(
  sql: Sql,
  messageId: string,
  attachments: AttachmentInput[],
): Promise<void> {
  if (attachments.length === 0) return;
  for (let i = 0; i < attachments.length; i++) {
    const a = attachments[i]!;
    await sql`
      INSERT INTO public.support_message_attachments
        (message_id, kind, url, thumbnail_url, width, height, display_order)
      VALUES (${messageId}, ${a.kind}, ${a.url}, ${a.thumbnailUrl ?? null}, ${a.width ?? null}, ${a.height ?? null}, ${i})
    `;
  }
}

/**
 * Batch-fetch attachments for a page of messages in ONE query (avoids N+1).
 * Returns a Map keyed by message_id; messages with no attachments are simply
 * absent from the map (callers default to []). Rows come back ordered by
 * (message_id, display_order) so each message's list is already in render order.
 */
export async function attachmentsForMessages(
  sql: Sql,
  messageIds: string[],
): Promise<Map<string, Attachment[]>> {
  const byMessage = new Map<string, Attachment[]>();
  if (messageIds.length === 0) return byMessage;

  const rows = await sql<{
    id: string;
    message_id: string;
    kind: 'image' | 'video';
    url: string;
    thumbnail_url: string | null;
    width: number | null;
    height: number | null;
  }[]>`
    SELECT id, message_id, kind, url, thumbnail_url, width, height
    FROM public.support_message_attachments
    WHERE message_id = ANY(${sql.array(messageIds)}::uuid[])
    ORDER BY message_id, display_order
  `;

  for (const r of rows) {
    if (!byMessage.has(r.message_id)) byMessage.set(r.message_id, []);
    byMessage.get(r.message_id)!.push({
      id: r.id,
      kind: r.kind,
      url: r.url,
      thumbnailUrl: r.thumbnail_url,
      width: r.width,
      height: r.height,
    });
  }

  return byMessage;
}
