import type { Sql } from '../db/client';

/**
 * Generic key/value platform settings. Currently powers the auto-"Trending"
 * ribbon threshold; new tunable global config can live here too.
 */
export interface TrendingConfig {
  /** Min paid purchases within the window for a deal to count as trending. */
  minPurchases: number;
  /** Rolling window in days. */
  windowDays: number;
}

const TRENDING_DEFAULTS: TrendingConfig = { minPurchases: 3, windowDays: 7 };

export async function getTrendingConfig(sql: Sql): Promise<TrendingConfig> {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM public.platform_settings
    WHERE key IN ('trending_min_purchases', 'trending_window_days')
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const minPurchases = Number(map.get('trending_min_purchases')) || TRENDING_DEFAULTS.minPurchases;
  const windowDays = Number(map.get('trending_window_days')) || TRENDING_DEFAULTS.windowDays;
  return { minPurchases, windowDays };
}

export async function setTrendingConfig(sql: Sql, cfg: TrendingConfig): Promise<TrendingConfig> {
  const minPurchases = Math.max(1, Math.floor(cfg.minPurchases));
  const windowDays = Math.max(1, Math.floor(cfg.windowDays));
  await sql`
    INSERT INTO public.platform_settings (key, value, updated_at) VALUES
      ('trending_min_purchases', ${String(minPurchases)}, now()),
      ('trending_window_days', ${String(windowDays)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return { minPurchases, windowDays };
}

/**
 * Whether to send a "leave a review" push the moment a voucher is redeemed.
 *
 * Deliberately OFF by default. The wallet already nudges redeemed-unreviewed
 * deals in-app on both mobile and web, which is the calm, non-annoying default.
 * This push is the optional aggressive layer — flip it on from admin god mode
 * if/when the review volume needs the extra prompt. See [[vibes-feature]] /
 * trending-config for the same key/value pattern.
 */
const REVIEW_PROMPT_PUSH_KEY = 'review_prompt_push_enabled';

export async function getReviewPromptPushEnabled(sql: Sql): Promise<boolean> {
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM public.platform_settings WHERE key = ${REVIEW_PROMPT_PUSH_KEY} LIMIT 1
  `;
  return rows[0]?.value === 'true';
}

export async function setReviewPromptPushEnabled(sql: Sql, enabled: boolean): Promise<boolean> {
  await sql`
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES (${REVIEW_PROMPT_PUSH_KEY}, ${enabled ? 'true' : 'false'}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return enabled;
}
