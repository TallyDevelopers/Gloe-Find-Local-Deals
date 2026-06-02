import type { DealSummary } from '@gloe/api-client';

/** Money + meta formatting for consumer cards. Ported from the mobile app so
 *  web and native render prices/ratings identically. */

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
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
