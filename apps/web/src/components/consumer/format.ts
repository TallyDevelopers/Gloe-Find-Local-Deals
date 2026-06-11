import type { DealSummary } from '@gloe/api-client';

/** Money + meta formatting for consumer cards. Ported from the mobile app so
 *  web and native render prices/ratings identically. */

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/** Exact money for credit amounts — "$20", or "$19.50" when the Stripe 50¢
 *  floor shaves the applied credit. Never rounds (formatPrice does). */
export function formatCredit(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function discountPct(originalCents: number, dealCents: number): number {
  if (originalCents <= 0) return 0;
  return Math.round(((originalCents - dealCents) / originalCents) * 100);
}

export function formatDistance(miles: number | null | undefined): string | null {
  if (miles == null) return null;
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatDriveTime(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

/** Combined Gloē + Google rating, e.g. "4.8 (127)". Null when nobody's rated. */
export function formatRating(vendor: DealSummary['vendor']): string | null {
  const rating = vendor.combinedRating;
  const count = vendor.combinedReviewCount;
  if (rating == null || count === 0) return null;
  return `${rating.toFixed(1)} (${count})`;
}

/** Combined review count, labeled. e.g. "188 reviews" / "1 review". Null if none. */
export function formatReviewCount(vendor: DealSummary['vendor']): string | null {
  const count = vendor.combinedReviewCount;
  if (!count) return null;
  return `${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/**
 * Human proximity for a listing: under a mile reads as a walk, otherwise a
 * drive time (falling back to raw distance if there's no drive estimate).
 * Walking pace ≈ 3 mph (20 min/mile).
 */
export function formatProximity(
  miles: number | null | undefined,
  driveSeconds: number | null | undefined,
): string | null {
  if (miles == null) return null;
  if (miles < 1) {
    const walkMin = Math.max(1, Math.round(miles * 20));
    return `${walkMin} min walk`;
  }
  // Use a real drive estimate when we have one; otherwise approximate at city
  // speed (~24 mph = 150 s/mile) so we always show a time, not raw distance.
  const drive = formatDriveTime(driveSeconds ?? miles * 150);
  return drive ? `${drive} drive` : formatDistance(miles);
}

/** Great-circle miles between two lat/lng points (Haversine). */
export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // earth radius, miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** "Expires in 3 days" / "Ends today" from an ISO timestamp. */
export function formatExpiry(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `Ends in ${days} days`;
  if (days === 1) return 'Ends tomorrow';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Ends in ${hours}h`;
  return 'Ends soon';
}
