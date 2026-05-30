import type { Sql } from '../db/client';

/**
 * Device-token store. APNs/FCM tokens are device-scoped (one per physical
 * device) but they get reassigned when a user signs into a different account
 * on the same device — so we treat `token` as the unique key and PATCH the
 * `user_id` on every upsert, ensuring the token is always pointed at whoever
 * is currently signed in there.
 *
 * Tokens are pushed up on every app launch (mobile re-registers each cold
 * start) so we also bump `last_seen_at` — that lets us prune dead devices
 * (~30+ day quiet = uninstalled/lost) without external Apple feedback.
 */

export type DevicePlatform = 'ios' | 'android';

export async function registerDeviceToken(
  sql: Sql,
  params: { userId: string; platform: DevicePlatform; token: string },
): Promise<void> {
  await sql`
    INSERT INTO public.device_tokens (user_id, platform, token, last_seen_at)
    VALUES (${params.userId}, ${params.platform}, ${params.token}, now())
    ON CONFLICT (token) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          platform = EXCLUDED.platform,
          last_seen_at = now()
  `;
}

export async function listIosTokensForUser(sql: Sql, userId: string): Promise<string[]> {
  const rows = await sql<{ token: string }[]>`
    SELECT token FROM public.device_tokens
    WHERE user_id = ${userId} AND platform = 'ios'
  `;
  return rows.map((r) => r.token);
}

/** Drop a token after APNs tells us it's dead (HTTP 410 / BadDeviceToken). */
export async function deleteDeviceToken(sql: Sql, token: string): Promise<void> {
  await sql`DELETE FROM public.device_tokens WHERE token = ${token}`;
}
