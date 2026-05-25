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
