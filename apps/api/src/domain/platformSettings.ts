import type { Sql, TxSql } from '../db/client';

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
 * How long a freshly issued voucher stays redeemable (GLO-29). This is the
 * platform-wide default; a deal can still carry its own `code_validity_days`
 * override (NULL on the deal = use this). Changing it affects NEW vouchers
 * only — already-issued vouchers keep their stored expires_at.
 */
const VOUCHER_VALIDITY_DEFAULT_DAYS = 90;

export async function getVoucherValidityDays(sql: Sql | TxSql): Promise<number> {
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM public.platform_settings WHERE key = 'voucher_validity_days' LIMIT 1
  `;
  return Number(rows[0]?.value) || VOUCHER_VALIDITY_DEFAULT_DAYS;
}

export async function setVoucherValidityDays(sql: Sql, days: number): Promise<number> {
  const clamped = Math.min(365, Math.max(1, Math.floor(days)));
  await sql`
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES ('voucher_validity_days', ${String(clamped)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return clamped;
}

/**
 * Dispute-risk policy (GLO-34). There is no universally "correct" number of
 * disputes that means a vendor is bad — it depends on your category, your
 * margins, and your tolerance. So the line is YOURS to draw, in god mode:
 *
 *   - `maxDisputes` + `windowDays` define the line: "more than N disputes in
 *     the last D days = this vendor is a problem." That's why the number field
 *     exists — you decide what "too many" is, not the code.
 *   - `enabled` is the toggle: turn the flag off entirely (e.g. pre-launch when
 *     there's no volume and every dispute is noise) without losing your number.
 *     That's why the toggle exists — so you can mute the warning without
 *     forgetting the threshold you picked.
 *
 * Nothing here auto-suspends anyone. It only decides when god mode paints the
 * red "⚠ high dispute rate" flag so YOU can decide whether to slash them.
 */
export interface DisputeRiskConfig {
  /** Flagging on/off. When false, no vendor is ever marked high-risk. */
  enabled: boolean;
  /** Flag a vendor with MORE THAN this many disputes inside the window. */
  maxDisputes: number;
  /** Trailing window, in days, the count is measured over. */
  windowDays: number;
}

const DISPUTE_RISK_DEFAULTS: DisputeRiskConfig = { enabled: true, maxDisputes: 2, windowDays: 90 };

export async function getDisputeRiskConfig(sql: Sql): Promise<DisputeRiskConfig> {
  const rows = await sql<{ key: string; value: string }[]>`
    SELECT key, value FROM public.platform_settings
    WHERE key IN ('dispute_risk_enabled', 'dispute_risk_max', 'dispute_risk_window_days')
  `;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.has('dispute_risk_enabled') ? map.get('dispute_risk_enabled') === 'true' : DISPUTE_RISK_DEFAULTS.enabled,
    maxDisputes: Number(map.get('dispute_risk_max')) || DISPUTE_RISK_DEFAULTS.maxDisputes,
    windowDays: Number(map.get('dispute_risk_window_days')) || DISPUTE_RISK_DEFAULTS.windowDays,
  };
}

export async function setDisputeRiskConfig(sql: Sql, cfg: DisputeRiskConfig): Promise<DisputeRiskConfig> {
  const enabled = !!cfg.enabled;
  const maxDisputes = Math.max(1, Math.floor(cfg.maxDisputes));
  const windowDays = Math.max(1, Math.floor(cfg.windowDays));
  await sql`
    INSERT INTO public.platform_settings (key, value, updated_at) VALUES
      ('dispute_risk_enabled', ${enabled ? 'true' : 'false'}, now()),
      ('dispute_risk_max', ${String(maxDisputes)}, now()),
      ('dispute_risk_window_days', ${String(windowDays)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return { enabled, maxDisputes, windowDays };
}

// NOTE: the review-prompt push toggle used to live here (review_prompt_push_enabled).
// It now lives in the notification registry (public.notification_types, key
// 'review_prompt') alongside every other push type — see domain/notifications.ts.
// The migration carried the old flag's value forward.
