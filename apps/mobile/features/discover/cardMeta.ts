/**
 * Formatting helpers for the meta line on deal cards
 * ("Test Vendor Spa · ★ 4.8 (52) · 12 min · 2.3 mi"). Used by every card type
 * so adding a field is a one-place change.
 */

import type { DealSummary } from '@gloe/api-client';

export function formatDistance(miles: number | null): string | null {
  if (miles === null) return null;
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatDriveTime(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h} hr`;
  return `${h}h ${m}m`;
}

/** Great-circle miles between two lat/lng points (Haversine). */
export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Human proximity: under a mile reads as a walk, otherwise a drive time
 * (estimated at ~24 mph when there's no server estimate). Walking ≈ 3 mph.
 */
export function formatProximity(miles: number | null, driveSeconds: number | null): string | null {
  if (miles === null) return null;
  if (miles < 1) {
    const walkMin = Math.max(1, Math.round(miles * 20));
    return `${walkMin} min walk`;
  }
  const drive = formatDriveTime(driveSeconds ?? miles * 150);
  return drive ? `${drive} drive` : formatDistance(miles);
}

/**
 * Combined Gloe + Google rating string, e.g. "★ 4.8 (127)". Falls back
 * gracefully when one source is missing; returns null when nobody's rated
 * the vendor anywhere.
 */
export function formatRating(vendor: DealSummary['vendor']): string | null {
  const rating = vendor.combinedRating;
  const count = vendor.combinedReviewCount;
  if (rating === null || count === 0) return null;
  return `★ ${rating.toFixed(1)} (${count})`;
}
