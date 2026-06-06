/**
 * Public-facing vendor storefront. This is what consumers see when they tap
 * into a vendor profile from a deal card, voucher, or search result.
 *
 * Pulls the full picture in one round-trip so mobile doesn't have to chain
 * 6 queries: vendor profile, active deals, providers, photos, videos,
 * Gloe-native reviews, cached Google reviews. Google review refresh runs
 * lazily on the way out — if the cache is older than 24 hours we hit the
 * API and update before responding. Otherwise we serve from cache.
 */

import type { Sql } from '../db/client';
import { getPlaceReviews, isMapsConfigured } from './googleMaps';

export interface VendorStorefront {
  vendor: {
    id: string;
    displayId: string;
    businessName: string;
    description: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    region: string;
    postalCode: string;
    phone: string | null;
    website: string | null;
    instagramHandle: string | null;
    heroImageUrl: string | null;
    logoUrl: string | null;
    hoursSummary: string | null;
    amenities: string[];
    /** The spa's vibe slugs (clinical/luxe/…). */
    vibes: string[];
    /** Editorial "Gloē's take" + perk chips, curated by admin. */
    gloeTake: string | null;
    gloePerks: string[];
    /** Vendor's own coordinates for "X miles away" math on the client. */
    lat: number | null;
    lng: number | null;
    ratingAvg: number | null;
    reviewCount: number;
    googleRating: number | null;
    googleReviewCount: number | null;
    googlePlaceId: string | null;
  };
  providers: Array<{
    id: string;
    name: string;
    title: string;
    bio: string | null;
    photoUrl: string | null;
  }>;
  activeDeals: Array<{
    id: string;
    title: string;
    categoryName: string;
    primaryPhotoUrl: string | null;
    minOriginalPriceCents: number | null;
    minDealPriceCents: number | null;
    expiresAt: string;
    isSponsored: boolean;
  }>;
  videos: Array<{
    id: string;
    videoUrl: string;
    thumbnailUrl: string;
    caption: string | null;
    durationSeconds: number | null;
  }>;
  gloeReviews: Array<{
    id: string;
    rating: number;
    body: string | null;
    authorFirstName: string | null;
    createdAt: string;
    photoUrls: string[];
  }>;
  googleReviews: Array<{
    authorName: string;
    profilePhotoUrl: string | null;
    rating: number;
    text: string | null;
    relativeTime: string;
  }>;
}

const GOOGLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function getVendorStorefront(sql: Sql, vendorId: string): Promise<VendorStorefront | null> {
  // --- 1. Vendor row (the spine) ---
  const vRows = await sql<{
    id: string;
    display_id: string;
    business_name: string;
    description: string | null;
    address_line1: string;
    address_line2: string | null;
    city: string;
    region: string;
    postal_code: string;
    phone: string | null;
    website: string | null;
    instagram_handle: string | null;
    hero_image_url: string | null;
    logo_url: string | null;
    hours_summary: string | null;
    amenities: unknown;
    vibes: unknown;
    gloe_take: string | null;
    gloe_perks: unknown;
    lat: number | null;
    lng: number | null;
    rating_avg: number | null;
    review_count: number;
    google_place_id: string | null;
    google_rating: number | null;
    google_review_count: number | null;
    google_reviews_fetched_at: string | null;
  }[]>`
    SELECT
      v.id, v.display_id, v.business_name, v.description,
      v.address_line1, v.address_line2, v.city, v.region, v.postal_code,
      v.phone, v.website, v.instagram_handle,
      v.hero_image_url, v.logo_url, v.hours_summary, v.amenities, v.vibes,
      v.gloe_take, v.gloe_perks,
      ST_Y(v.location::geometry) AS lat,
      ST_X(v.location::geometry) AS lng,
      v.rating_avg, v.review_count,
      v.google_place_id, v.google_rating, v.google_review_count, v.google_reviews_fetched_at
    FROM public.vendors v
    WHERE v.id = ${vendorId} AND v.status = 'active'
    LIMIT 1
  `;
  const v = vRows[0];
  if (!v) return null;

  // --- 2. Refresh Google reviews if cache is stale (best-effort, non-blocking math) ---
  if (v.google_place_id && isMapsConfigured()) {
    const lastFetched = v.google_reviews_fetched_at ? new Date(v.google_reviews_fetched_at).getTime() : 0;
    const isStale = Date.now() - lastFetched > GOOGLE_CACHE_TTL_MS;
    if (isStale) {
      try {
        await refreshGoogleReviews(sql, vendorId, v.google_place_id);
      } catch (e) {
        // Logging only — never fail the whole storefront because Google's down.
        console.error(`Google review refresh failed for vendor ${vendorId}:`, (e as Error).message);
      }
    }
  }

  // --- 3. Everything else in parallel ---
  const [providersRes, dealsRes, videosRes, gloeReviewsRes, googleReviewsRes, freshAggRes] = await Promise.all([
    sql<{ id: string; name: string; title: string; bio: string | null; photo_url: string | null }[]>`
      SELECT id, name, title, bio, photo_url
      FROM public.providers
      WHERE vendor_id = ${vendorId}
      ORDER BY display_order, name
    `,
    sql<{
      id: string;
      title: string;
      category_name: string;
      primary_photo_url: string | null;
      min_original: number | null;
      min_deal: number | null;
      expires_at: string;
      is_sponsored: boolean;
    }[]>`
      SELECT
        d.id, d.title,
        c.display_name AS category_name,
        (SELECT url FROM public.deal_photos p WHERE p.deal_id = d.id
          ORDER BY CASE WHEN p.photo_type = 'hero' THEN 0 ELSE 1 END, p.display_order
          LIMIT 1) AS primary_photo_url,
        (SELECT MIN(original_price_cents) FROM public.deal_variants dv WHERE dv.deal_id = d.id) AS min_original,
        (SELECT MIN(deal_price_cents)     FROM public.deal_variants dv WHERE dv.deal_id = d.id) AS min_deal,
        d.expires_at, d.is_sponsored
      FROM public.deals d
      JOIN public.service_categories c ON c.id = d.category_id
      WHERE d.vendor_id = ${vendorId}
        AND d.status = 'active'
        AND d.expires_at > now()
      ORDER BY d.is_sponsored DESC, d.created_at DESC
    `,
    sql<{ id: string; video_url: string; thumbnail_url: string; caption: string | null; duration_seconds: number | null }[]>`
      SELECT id, video_url, thumbnail_url, caption, duration_seconds
      FROM public.vendor_videos
      WHERE vendor_id = ${vendorId}
      ORDER BY display_order, created_at DESC
      LIMIT 12
    `,
    sql<{ id: string; rating: number; body: string | null; first_name: string | null; created_at: string }[]>`
      SELECT r.id, r.rating, r.body, u.first_name, r.created_at
      FROM public.reviews r
      JOIN public.users u ON u.id = r.user_id
      WHERE r.vendor_id = ${vendorId} AND r.is_hidden = false
      ORDER BY r.created_at DESC
      LIMIT 10
    `,
    sql<{ author_name: string; profile_photo_url: string | null; rating: number; text: string | null; authored_at: string }[]>`
      SELECT author_name, profile_photo_url, rating, text, authored_at
      FROM public.vendor_google_reviews
      WHERE vendor_id = ${vendorId}
      ORDER BY authored_at DESC
      LIMIT 5
    `,
    // Re-read aggregate in case the refresh above bumped it.
    sql<{ google_rating: number | null; google_review_count: number | null }[]>`
      SELECT google_rating, google_review_count FROM public.vendors WHERE id = ${vendorId}
    `,
  ]);

  const freshAgg = freshAggRes[0];

  // Pull photos for the page of reviews we just fetched. One query, one round-trip.
  const reviewIds = gloeReviewsRes.map((r) => r.id);
  const reviewPhotos: { review_id: string; url: string }[] = reviewIds.length > 0
    ? await sql<{ review_id: string; url: string }[]>`
        SELECT review_id, url FROM public.review_photos
        WHERE review_id = ANY(${sql.array(reviewIds)})
        ORDER BY display_order
      `
    : [];
  const photosByReview = new Map<string, string[]>();
  for (const p of reviewPhotos) {
    if (!photosByReview.has(p.review_id)) photosByReview.set(p.review_id, []);
    photosByReview.get(p.review_id)!.push(p.url);
  }

  return {
    vendor: {
      id: v.id,
      displayId: v.display_id,
      businessName: v.business_name,
      description: v.description,
      addressLine1: v.address_line1,
      addressLine2: v.address_line2,
      city: v.city,
      region: v.region,
      postalCode: v.postal_code,
      phone: v.phone,
      website: v.website,
      instagramHandle: v.instagram_handle,
      heroImageUrl: v.hero_image_url,
      logoUrl: v.logo_url,
      hoursSummary: v.hours_summary,
      amenities: Array.isArray(v.amenities) ? (v.amenities as string[]) : [],
      vibes: Array.isArray(v.vibes) ? (v.vibes as string[]) : [],
      gloeTake: v.gloe_take,
      gloePerks: Array.isArray(v.gloe_perks) ? (v.gloe_perks as string[]) : [],
      lat: v.lat,
      lng: v.lng,
      // numeric() columns come back as strings from the pg driver — coerce so
      // the declared `number` type is true at runtime (callers do .toFixed()).
      ratingAvg: v.rating_avg == null ? null : Number(v.rating_avg),
      reviewCount: Number(v.review_count) || 0,
      googleRating: (() => {
        const g = freshAgg?.google_rating ?? v.google_rating;
        return g == null ? null : Number(g);
      })(),
      googleReviewCount: (() => {
        const c = freshAgg?.google_review_count ?? v.google_review_count;
        return c == null ? null : Number(c);
      })(),
      googlePlaceId: v.google_place_id,
    },
    providers: providersRes.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      bio: p.bio,
      photoUrl: p.photo_url,
    })),
    activeDeals: dealsRes.map((d) => ({
      id: d.id,
      title: d.title,
      categoryName: d.category_name,
      primaryPhotoUrl: d.primary_photo_url,
      minOriginalPriceCents: d.min_original,
      minDealPriceCents: d.min_deal,
      expiresAt: d.expires_at,
      isSponsored: d.is_sponsored,
    })),
    videos: videosRes.map((v) => ({
      id: v.id,
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url,
      caption: v.caption,
      durationSeconds: v.duration_seconds,
    })),
    gloeReviews: gloeReviewsRes.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      authorFirstName: r.first_name,
      createdAt: r.created_at,
      photoUrls: photosByReview.get(r.id) ?? [],
    })),
    googleReviews: googleReviewsRes.map((r) => ({
      authorName: r.author_name,
      profilePhotoUrl: r.profile_photo_url,
      rating: r.rating,
      text: r.text,
      relativeTime: humanizeAuthoredAt(r.authored_at),
    })),
  };
}

/**
 * Pulls fresh Google reviews and upserts them into our cache. Also bumps the
 * aggregate columns on `vendors` so we can show "★ 4.8 (127 reviews)" without
 * joining the reviews table. Quiet failure: log and continue.
 */
async function refreshGoogleReviews(sql: Sql, vendorId: string, placeId: string): Promise<void> {
  const fresh = await getPlaceReviews(placeId);
  if (!fresh.available) return;

  // Aggregate first (cheaper if reviews list is empty).
  await sql`
    UPDATE public.vendors
    SET google_rating       = ${fresh.rating},
        google_review_count = ${fresh.totalRatings},
        google_reviews_fetched_at = now()
    WHERE id = ${vendorId}
  `;

  for (const r of fresh.reviews) {
    // Google's `relative_time_description` doesn't give us an absolute date,
    // so we approximate authored_at as the API call time. Good enough for
    // ordering since Google already returns "newest" when we ask.
    await sql`
      INSERT INTO public.vendor_google_reviews
        (vendor_id, author_name, profile_photo_url, rating, text, language, authored_at)
      VALUES
        (${vendorId}, ${r.authorName}, ${r.photoUrl}, ${r.rating}, ${r.text}, NULL, now())
      ON CONFLICT (vendor_id, author_name, authored_at) DO UPDATE
      SET rating = EXCLUDED.rating,
          text = EXCLUDED.text,
          profile_photo_url = EXCLUDED.profile_photo_url,
          fetched_at = now()
    `;
  }
}

function humanizeAuthoredAt(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
}
