import type { Sql } from '../db/client';

/**
 * Region waitlist — captures people who open the app outside the current
 * launch area (no deals within ~50mi). One row per email; re-signups update
 * their latest city/coords. Powers the consumer "coming soon" screen capture
 * and the admin demand-by-city view.
 */

export interface WaitlistJoinInput {
  email: string;
  cityLabel?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Upsert a waitlist signup. Idempotent on lowercased email. */
export async function joinWaitlist(
  sql: Sql,
  input: WaitlistJoinInput,
): Promise<{ ok: true }> {
  const email = input.email.trim();
  await sql`
    INSERT INTO public.region_waitlist (email, city_label, lat, lng)
    VALUES (${email}, ${input.cityLabel ?? null}, ${input.lat ?? null}, ${input.lng ?? null})
    ON CONFLICT (lower(email)) DO UPDATE SET
      city_label = COALESCE(EXCLUDED.city_label, public.region_waitlist.city_label),
      lat        = COALESCE(EXCLUDED.lat, public.region_waitlist.lat),
      lng        = COALESCE(EXCLUDED.lng, public.region_waitlist.lng),
      updated_at = now()
  `;
  return { ok: true };
}

export interface WaitlistCityRollup {
  cityLabel: string | null;
  count: number;
  latestAt: string;
}

/** Admin: demand grouped by city, busiest first. The expansion roadmap. */
export async function listWaitlistByCity(sql: Sql): Promise<WaitlistCityRollup[]> {
  const rows = await sql<{ city_label: string | null; count: number; latest_at: string }[]>`
    SELECT city_label, count(*)::int AS count, max(created_at) AS latest_at
    FROM public.region_waitlist
    GROUP BY city_label
    ORDER BY count DESC, latest_at DESC
  `;
  return rows.map((r) => ({ cityLabel: r.city_label, count: r.count, latestAt: r.latest_at }));
}

export interface WaitlistEntry {
  id: string;
  email: string;
  cityLabel: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

/** Admin: raw signups, newest first. Optional city filter. */
export async function listWaitlistEntries(
  sql: Sql,
  opts: { city?: string | null; limit?: number } = {},
): Promise<WaitlistEntry[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  const rows = await sql<{
    id: string;
    email: string;
    city_label: string | null;
    lat: number | null;
    lng: number | null;
    created_at: string;
  }[]>`
    SELECT id, email, city_label, lat, lng, created_at
    FROM public.region_waitlist
    WHERE ${opts.city ? sql`city_label = ${opts.city}` : sql`true`}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    cityLabel: r.city_label,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
  }));
}

export interface WaitlistTotals {
  total: number;
  cities: number;
}

export async function getWaitlistTotals(sql: Sql): Promise<WaitlistTotals> {
  const rows = await sql<{ total: number; cities: number }[]>`
    SELECT count(*)::int AS total, count(DISTINCT city_label)::int AS cities
    FROM public.region_waitlist
  `;
  return { total: rows[0]?.total ?? 0, cities: rows[0]?.cities ?? 0 };
}
