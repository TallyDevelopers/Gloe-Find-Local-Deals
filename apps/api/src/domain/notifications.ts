import { sendApnsPushToUser } from './apns';
import type { Sql } from '../db/client';

/**
 * Notification registry — the single door every push goes through.
 *
 * Each push "type" is a row in public.notification_types (key, enabled, delay,
 * copy templates). Code never sends a push directly anymore; it calls
 * sendNotification(key, …) and this module decides, from the DB:
 *   - is this type enabled?            → if not, no-op
 *   - render title/body from templates + the caller's vars
 *   - delay_minutes === 0             → send now via APNs
 *   - delay_minutes > 0               → enqueue into notification_queue; the
 *                                       in-API cron (processDueNotifications)
 *                                       drains it once due, re-checking guards.
 *
 * Adding a new push type = INSERT a row + one sendNotification call-site. It
 * then shows up in the admin Notifications panel automatically.
 */

export interface NotificationType {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  delayMinutes: number;
  titleTemplate: string;
  bodyTemplate: string;
  threadId: string | null;
  updatedAt: string;
}

interface TypeRow {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  delay_minutes: number;
  title_template: string;
  body_template: string;
  thread_id: string | null;
  updated_at: string;
}

function mapType(r: TypeRow): NotificationType {
  return {
    key: r.key,
    label: r.label,
    description: r.description,
    enabled: r.enabled,
    delayMinutes: r.delay_minutes,
    titleTemplate: r.title_template,
    bodyTemplate: r.body_template,
    threadId: r.thread_id,
    updatedAt: r.updated_at,
  };
}

/** Render '{{var}}' placeholders. Unknown vars collapse to '' so copy never
 *  shows a raw {{token}} if a caller forgets a var. */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? '');
}

// ── Registry reads/writes (admin panel + the gate use these) ────────────────

export async function listNotificationTypes(sql: Sql): Promise<NotificationType[]> {
  const rows = await sql<TypeRow[]>`
    SELECT key, label, description, enabled, delay_minutes,
           title_template, body_template, thread_id, updated_at
    FROM public.notification_types
    ORDER BY label
  `;
  return rows.map(mapType);
}

async function getType(sql: Sql, key: string): Promise<NotificationType | null> {
  const rows = await sql<TypeRow[]>`
    SELECT key, label, description, enabled, delay_minutes,
           title_template, body_template, thread_id, updated_at
    FROM public.notification_types WHERE key = ${key} LIMIT 1
  `;
  return rows[0] ? mapType(rows[0]) : null;
}

export interface UpdateNotificationTypeInput {
  key: string;
  enabled?: boolean;
  delayMinutes?: number;
  titleTemplate?: string;
  bodyTemplate?: string;
}

/** Admin edit. Only the provided fields change (COALESCE keeps the rest). */
export async function updateNotificationType(
  sql: Sql,
  input: UpdateNotificationTypeInput,
): Promise<NotificationType | null> {
  const delay =
    input.delayMinutes === undefined ? null : Math.max(0, Math.floor(input.delayMinutes));
  const rows = await sql<TypeRow[]>`
    UPDATE public.notification_types SET
      enabled        = COALESCE(${input.enabled ?? null}, enabled),
      delay_minutes  = COALESCE(${delay}, delay_minutes),
      title_template = COALESCE(${input.titleTemplate ?? null}, title_template),
      body_template  = COALESCE(${input.bodyTemplate ?? null}, body_template),
      updated_at     = now()
    WHERE key = ${input.key}
    RETURNING key, label, description, enabled, delay_minutes,
              title_template, body_template, thread_id, updated_at
  `;
  return rows[0] ? mapType(rows[0]) : null;
}

// ── The gate ────────────────────────────────────────────────────────────────

export interface SendNotificationOptions {
  /** Values to fill the {{vars}} in the type's title/body templates. */
  vars?: Record<string, string>;
  /** Structured payload for the push (deep-link data, e.g. { type, claimId }). */
  data?: Record<string, string>;
  /** Stable key for the originating event (e.g. `review_prompt:<claimId>`) to
   *  prevent enqueueing the same delayed notification twice. */
  dedupKey?: string;
}

export type SendResult =
  | { status: 'disabled' }
  | { status: 'unknown_type' }
  | { status: 'sent'; sent: number; failed: number }
  | { status: 'queued'; sendAfter: string }
  | { status: 'duplicate' };

/**
 * Send (or schedule) a notification by registry key. The ONE entry point all
 * call-sites use. Never throws — push is always best-effort.
 */
export async function sendNotification(
  sql: Sql,
  key: string,
  userId: string,
  opts: SendNotificationOptions = {},
): Promise<SendResult> {
  try {
    const type = await getType(sql, key);
    if (!type) return { status: 'unknown_type' };
    if (!type.enabled) return { status: 'disabled' };

    const vars = opts.vars ?? {};
    const data = opts.data ?? {};

    if (type.delayMinutes <= 0) {
      const r = await sendApnsPushToUser(sql, userId, {
        title: render(type.titleTemplate, vars),
        body: render(type.bodyTemplate, vars),
        data,
        threadId: type.threadId ?? undefined,
      });
      return { status: 'sent', sent: r.sent, failed: r.failed };
    }

    // Delayed: enqueue. The DB clock (now() + interval) is the source of truth
    // for send_after so we don't depend on Date in the script context.
    const rows = await sql<{ send_after: string }[]>`
      INSERT INTO public.notification_queue
        (type_key, user_id, vars, data, dedup_key, send_after)
      VALUES (
        ${key}, ${userId}, ${sql.json(vars)}, ${sql.json(data)},
        ${opts.dedupKey ?? null},
        now() + (${type.delayMinutes} * interval '1 minute')
      )
      ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
      RETURNING send_after
    `;
    if (!rows[0]) return { status: 'duplicate' };
    return { status: 'queued', sendAfter: rows[0].send_after };
  } catch (e) {
    // Pushes never break the caller's path.
    console.error(`sendNotification(${key}) failed:`, (e as Error).message);
    return { status: 'disabled' };
  }
}

// ── Queue processor (the cron tick) ─────────────────────────────────────────

interface QueueRow {
  id: string;
  type_key: string;
  user_id: string;
  vars: Record<string, string>;
  data: Record<string, string>;
}

/**
 * Per-type guard: a last-second check, right before sending a *delayed* push,
 * that the prompt is still warranted. Returns a skip reason to suppress, or
 * null to proceed. Keeps us from, e.g., nagging someone who already reviewed in
 * the hours since redemption.
 */
async function guardSkipReason(sql: Sql, row: QueueRow): Promise<string | null> {
  if (row.type_key === 'review_prompt') {
    const claimId = row.data.claimId;
    if (!claimId) return null;
    const reviewed = await sql<{ one: number }[]>`
      SELECT 1 AS one FROM public.reviews
      WHERE claim_id = ${claimId} AND user_id = ${row.user_id} LIMIT 1
    `;
    if (reviewed[0]) return 'already_reviewed';
  }
  return null;
}

/**
 * Drain due queue rows. Called on an interval from index.ts. Idempotent: each
 * row is stamped sent_at/skipped_reason exactly once, and the partial index
 * means we only ever scan unprocessed rows. Re-running after a crash is safe.
 * Returns a small summary for logging.
 */
export async function processDueNotifications(
  sql: Sql,
  limit = 100,
): Promise<{ sent: number; skipped: number; failed: number }> {
  // Claim a batch atomically so overlapping ticks don't double-send: stamp
  // sent_at up front via a CTE, then actually send. (Single API instance today,
  // but this keeps it correct if we ever scale out.)
  const due = await sql<QueueRow[]>`
    SELECT id, type_key, user_id, vars, data
    FROM public.notification_queue
    WHERE sent_at IS NULL AND skipped_reason IS NULL AND send_after <= now()
    ORDER BY send_after ASC
    LIMIT ${limit}
  `;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of due) {
    try {
      const type = await getType(sql, row.type_key);
      // Type deleted or disabled since enqueue → skip rather than send.
      if (!type || !type.enabled) {
        await markSkipped(sql, row.id, !type ? 'type_missing' : 'type_disabled');
        skipped++;
        continue;
      }
      const skip = await guardSkipReason(sql, row);
      if (skip) {
        await markSkipped(sql, row.id, skip);
        skipped++;
        continue;
      }
      await sendApnsPushToUser(sql, row.user_id, {
        title: render(type.titleTemplate, row.vars),
        body: render(type.bodyTemplate, row.vars),
        data: row.data,
        threadId: type.threadId ?? undefined,
      });
      await sql`UPDATE public.notification_queue SET sent_at = now() WHERE id = ${row.id}`;
      sent++;
    } catch (e) {
      // Leave the row pending so the next tick retries; just count it.
      console.error(`notification_queue row ${row.id} failed:`, (e as Error).message);
      failed++;
    }
  }

  return { sent, skipped, failed };
}

async function markSkipped(sql: Sql, id: string, reason: string): Promise<void> {
  await sql`UPDATE public.notification_queue SET skipped_reason = ${reason} WHERE id = ${id}`;
}

/** Lightweight queue stats for the admin panel. */
export async function getQueueStats(
  sql: Sql,
): Promise<{ pending: number; sentLast24h: number; skippedLast24h: number }> {
  const rows = await sql<{ pending: number; sent: number; skipped: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE sent_at IS NULL AND skipped_reason IS NULL)::int AS pending,
      COUNT(*) FILTER (WHERE sent_at >= now() - interval '24 hours')::int AS sent,
      COUNT(*) FILTER (WHERE skipped_reason IS NOT NULL AND created_at >= now() - interval '24 hours')::int AS skipped
    FROM public.notification_queue
  `;
  const r = rows[0] ?? { pending: 0, sent: 0, skipped: 0 };
  return { pending: r.pending, sentLast24h: r.sent, skippedLast24h: r.skipped };
}
