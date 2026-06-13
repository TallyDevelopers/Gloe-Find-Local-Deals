import type { Sql } from '../db/client';
import { reverseGeocodeCity } from './googleMaps';

/**
 * Last-known approximate customer location (admin market context, GLO-7 data).
 *
 * Captured opportunistically from signed-in browse calls — the app already
 * sends coords to deals.list/discoverFeed/search for distance ranking; this
 * just stops throwing them away. Privacy posture:
 *  - foreground-only by construction (a browse call IS the app being used)
 *  - rounded to 3 decimals (~110 m — city-block resolution, never exact)
 *  - throttled to one write per user per 15 minutes
 *  - city label re-geocoded only on a ≥10 km move (pennies, not per-browse)
 */

const THROTTLE_MINUTES = 15;
const REGEOCODE_KM = 10;

/** Haversine, good enough for "did they move cities". */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Record a signed-in user's approximate position. Designed to be called
 * fire-and-forget from hot read paths — it exits in one SELECT when inside
 * the throttle window, and never throws (a location miss must not break
 * browsing).
 */
export async function recordUserLocation(
  sql: Sql,
  userId: string,
  lat: number,
  lng: number,
): Promise<void> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    // ~City-block resolution. We never want exact coordinates on the books.
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;

    const rows = await sql<{
      last_lat: number | null;
      last_lng: number | null;
      last_city: string | null;
      stale: boolean;
    }[]>`
      SELECT last_lat, last_lng, last_city,
             (last_location_at IS NULL
              OR last_location_at < now() - (${THROTTLE_MINUTES} * interval '1 minute')) AS stale
      FROM public.users
      WHERE id = ${userId} AND deleted_at IS NULL
      LIMIT 1
    `;
    const prev = rows[0];
    if (!prev || !prev.stale) return;

    const moved =
      prev.last_lat == null || prev.last_lng == null
        ? Infinity
        : distanceKm(prev.last_lat, prev.last_lng, roundedLat, roundedLng);

    let city = prev.last_city;
    if (city == null || moved >= REGEOCODE_KM) {
      city = await reverseGeocodeCity(roundedLat, roundedLng).catch(() => null) ?? city;
    }

    await sql`
      UPDATE public.users
      SET last_lat = ${roundedLat}, last_lng = ${roundedLng},
          last_city = ${city}, last_location_at = now()
      WHERE id = ${userId} AND deleted_at IS NULL
    `;
  } catch (e) {
    console.error('[userLocation] record failed:', (e as Error).message);
  }
}
