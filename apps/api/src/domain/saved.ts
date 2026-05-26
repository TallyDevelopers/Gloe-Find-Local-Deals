import type { Sql } from '../db/client';

/* ─────────────── deals ─────────────── */

export async function listSavedDealIds(sql: Sql, userId: string): Promise<string[]> {
  const rows = await sql<{ deal_id: string }[]>`
    SELECT deal_id FROM public.saved_deals WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return rows.map((r) => r.deal_id);
}

/**
 * Toggle a save. Returns the new saved state.
 */
export async function toggleSaved(
  sql: Sql,
  userId: string,
  dealId: string,
): Promise<{ saved: boolean }> {
  const existing = await sql<{ deal_id: string }[]>`
    SELECT deal_id FROM public.saved_deals
    WHERE user_id = ${userId} AND deal_id = ${dealId}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM public.saved_deals WHERE user_id = ${userId} AND deal_id = ${dealId}`;
    return { saved: false };
  }
  await sql`
    INSERT INTO public.saved_deals (user_id, deal_id)
    VALUES (${userId}, ${dealId})
  `;
  return { saved: true };
}

/* ─────────────── vendors ─────────────── */

export async function listSavedVendorIds(sql: Sql, userId: string): Promise<string[]> {
  const rows = await sql<{ vendor_id: string }[]>`
    SELECT vendor_id FROM public.saved_vendors WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return rows.map((r) => r.vendor_id);
}

/**
 * The Saved → Spas tab needs more than just IDs — it needs cards rendered.
 * Returns the vendor + key fields for a list card in one round-trip, newest
 * save first. Filters out vendors whose status is no longer 'active' so
 * suspended spas don't haunt the list.
 */
export interface SavedVendorCard {
  vendorId: string;
  businessName: string;
  city: string;
  region: string;
  heroImageUrl: string | null;
  ratingAvg: number | null;
  reviewCount: number;
  googleRating: number | null;
  googleReviewCount: number | null;
  activeDealCount: number;
  savedAt: string;
}

export async function listSavedVendors(sql: Sql, userId: string): Promise<SavedVendorCard[]> {
  const rows = await sql<{
    vendor_id: string;
    business_name: string;
    city: string;
    region: string;
    hero_image_url: string | null;
    rating_avg: number | null;
    review_count: number;
    google_rating: number | null;
    google_review_count: number | null;
    active_deal_count: number;
    saved_at: string;
  }[]>`
    SELECT
      sv.vendor_id,
      v.business_name,
      v.city,
      v.region,
      v.hero_image_url,
      v.rating_avg,
      v.review_count,
      v.google_rating,
      v.google_review_count,
      (SELECT COUNT(*)::int FROM public.deals d
        WHERE d.vendor_id = v.id
          AND d.status = 'active'
          AND d.expires_at > now()) AS active_deal_count,
      sv.created_at AS saved_at
    FROM public.saved_vendors sv
    JOIN public.vendors v ON v.id = sv.vendor_id
    WHERE sv.user_id = ${userId}
      AND v.status = 'active'
    ORDER BY sv.created_at DESC
  `;
  return rows.map((r) => ({
    vendorId: r.vendor_id,
    businessName: r.business_name,
    city: r.city,
    region: r.region,
    heroImageUrl: r.hero_image_url,
    ratingAvg: r.rating_avg,
    reviewCount: r.review_count,
    googleRating: r.google_rating,
    googleReviewCount: r.google_review_count,
    activeDealCount: r.active_deal_count,
    savedAt: r.saved_at,
  }));
}

export async function toggleSavedVendor(
  sql: Sql,
  userId: string,
  vendorId: string,
): Promise<{ saved: boolean }> {
  const existing = await sql<{ vendor_id: string }[]>`
    SELECT vendor_id FROM public.saved_vendors
    WHERE user_id = ${userId} AND vendor_id = ${vendorId}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM public.saved_vendors WHERE user_id = ${userId} AND vendor_id = ${vendorId}`;
    return { saved: false };
  }
  await sql`
    INSERT INTO public.saved_vendors (user_id, vendor_id)
    VALUES (${userId}, ${vendorId})
  `;
  return { saved: true };
}
