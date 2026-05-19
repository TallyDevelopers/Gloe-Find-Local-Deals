import type { Sql } from '../db/client';

/**
 * Domain types — what the API returns. These are the contract with clients.
 * Keep them shaped so the mobile app's existing UI bindings work with minimal
 * change.
 */

export interface DealVariant {
  id: string;
  label: string;
  unitCount: number | null;
  unitLabel: string | null;
  originalPriceCents: number;
  dealPriceCents: number;
  spotsTotal: number | null;
  spotsClaimed: number;
}

export interface DealPhoto {
  id: string;
  url: string;
  photoType: 'hero' | 'gallery' | 'before_after';
  displayOrder: number;
}

export interface DealVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string | null;
  durationSeconds: number | null;
}

export interface DealVendor {
  id: string;
  businessName: string;
  city: string;
  ratingAvg: number | null;
  reviewCount: number;
  hoursSummary: string | null;
  address: string;
}

export interface DealProvider {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  photoUrl: string | null;
}

export interface DealCategory {
  slug: string;
  displayName: string;
  subtypeSlug: string | null;
  subtypeDisplayName: string | null;
}

export interface DealSummary {
  id: string;
  title: string;
  category: DealCategory;
  expiresAt: string;
  isSponsored: boolean;
  vendor: DealVendor;
  primaryPhotoUrl: string | null;
  /** Distance from the requesting user's location, if known. */
  distanceMiles: number | null;
  /** Headline variant (the first one) for feed display. */
  headlineVariant: DealVariant | null;
}

export interface DealDetail extends DealSummary {
  description: string;
  whatsIncluded: string[];
  restrictions: string[];
  finePrint: string | null;
  variants: DealVariant[];
  photos: DealPhoto[];
  videos: DealVideo[];
  providers: DealProvider[];
}

// ============================================================
// Queries
// ============================================================

interface ListParams {
  userLat?: number;
  userLng?: number;
  maxDistanceMiles?: number;
  category?: string;
  limit?: number;
}

export async function listDeals(sql: Sql, params: ListParams = {}): Promise<DealSummary[]> {
  const { userLat, userLng, maxDistanceMiles = 50, category, limit = 50 } = params;
  const hasUserLocation = typeof userLat === 'number' && typeof userLng === 'number';
  const radiusMeters = maxDistanceMiles * 1609.344;

  const rows = await sql<DealListRow[]>`
    SELECT
      d.id,
      d.title,
      d.expires_at,
      d.is_sponsored,
      c.slug          AS category_slug,
      c.display_name  AS category_display_name,
      s.slug          AS subtype_slug,
      s.display_name  AS subtype_display_name,
      v.id            AS vendor_id,
      v.business_name AS vendor_business_name,
      v.city          AS vendor_city,
      v.rating_avg    AS vendor_rating_avg,
      v.review_count  AS vendor_review_count,
      v.hours_summary AS vendor_hours_summary,
      v.address_line1 AS vendor_address_line1,
      (
        SELECT url FROM public.deal_photos p
        WHERE p.deal_id = d.id
        ORDER BY CASE WHEN p.photo_type = 'hero' THEN 0 ELSE 1 END, p.display_order
        LIMIT 1
      ) AS primary_photo_url,
      ${
        hasUserLocation
          ? sql`ST_Distance(
              v.location,
              ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography
            ) / 1609.344`
          : sql`NULL`
      } AS distance_miles
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    JOIN public.service_categories c ON c.id = d.category_id
    LEFT JOIN public.service_subtypes s ON s.id = d.subtype_id
    WHERE d.status = 'active'
      AND v.status = 'active'
      AND d.expires_at > now()
      ${category ? sql`AND c.slug = ${category}` : sql``}
      ${
        hasUserLocation
          ? sql`AND ST_DWithin(
                v.location,
                ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
                ${radiusMeters}
              )`
          : sql``
      }
    ORDER BY
      d.is_sponsored DESC,
      ${
        hasUserLocation
          ? sql`v.location <-> ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography`
          : sql`d.created_at DESC`
      }
    LIMIT ${limit}
  `;

  const dealIds = rows.map((r) => r.id);
  const headlineVariants = await fetchHeadlineVariants(sql, dealIds);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    expiresAt: r.expires_at,
    isSponsored: r.is_sponsored,
    category: {
      slug: r.category_slug,
      displayName: r.category_display_name,
      subtypeSlug: r.subtype_slug,
      subtypeDisplayName: r.subtype_display_name,
    },
    vendor: {
      id: r.vendor_id,
      businessName: r.vendor_business_name,
      city: r.vendor_city,
      ratingAvg: r.vendor_rating_avg !== null ? Number(r.vendor_rating_avg) : null,
      reviewCount: r.vendor_review_count,
      hoursSummary: r.vendor_hours_summary,
      address: r.vendor_address_line1,
    },
    primaryPhotoUrl: r.primary_photo_url,
    distanceMiles: r.distance_miles !== null ? Number(r.distance_miles) : null,
    headlineVariant: headlineVariants.get(r.id) ?? null,
  }));
}

export async function getDeal(sql: Sql, dealId: string): Promise<DealDetail | null> {
  const dealRows = await sql<DealDetailRow[]>`
    SELECT
      d.id, d.title, d.description, d.whats_included, d.restrictions, d.fine_print,
      d.expires_at, d.is_sponsored,
      c.slug AS category_slug, c.display_name AS category_display_name,
      s.slug AS subtype_slug, s.display_name AS subtype_display_name,
      v.id            AS vendor_id,
      v.business_name AS vendor_business_name,
      v.city          AS vendor_city,
      v.rating_avg    AS vendor_rating_avg,
      v.review_count  AS vendor_review_count,
      v.hours_summary AS vendor_hours_summary,
      v.address_line1 AS vendor_address_line1
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    JOIN public.service_categories c ON c.id = d.category_id
    LEFT JOIN public.service_subtypes s ON s.id = d.subtype_id
    WHERE d.id = ${dealId} AND d.status = 'active'
    LIMIT 1
  `;
  const deal = dealRows[0];
  if (!deal) return null;

  const [variants, photos, videos, providers] = await Promise.all([
    sql<VariantRow[]>`
      SELECT id, label, unit_count, unit_label, original_price_cents, deal_price_cents,
             spots_total, spots_claimed
      FROM public.deal_variants
      WHERE deal_id = ${dealId} AND active = true
      ORDER BY display_order, label
    `,
    sql<PhotoRow[]>`
      SELECT id, url, photo_type, display_order
      FROM public.deal_photos
      WHERE deal_id = ${dealId}
      ORDER BY CASE WHEN photo_type='hero' THEN 0 ELSE 1 END, display_order
    `,
    sql<VideoRow[]>`
      SELECT id, video_url, thumbnail_url, caption, duration_seconds
      FROM public.deal_videos
      WHERE deal_id = ${dealId}
      ORDER BY display_order
    `,
    sql<ProviderRow[]>`
      SELECT id, name, title, bio, photo_url
      FROM public.providers
      WHERE vendor_id = ${deal.vendor_id}
      ORDER BY display_order, name
    `,
  ]);

  return {
    id: deal.id,
    title: deal.title,
    description: deal.description,
    whatsIncluded: deal.whats_included as string[],
    restrictions: deal.restrictions as string[],
    finePrint: deal.fine_print,
    expiresAt: deal.expires_at,
    isSponsored: deal.is_sponsored,
    category: {
      slug: deal.category_slug,
      displayName: deal.category_display_name,
      subtypeSlug: deal.subtype_slug,
      subtypeDisplayName: deal.subtype_display_name,
    },
    vendor: {
      id: deal.vendor_id,
      businessName: deal.vendor_business_name,
      city: deal.vendor_city,
      ratingAvg: deal.vendor_rating_avg !== null ? Number(deal.vendor_rating_avg) : null,
      reviewCount: deal.vendor_review_count,
      hoursSummary: deal.vendor_hours_summary,
      address: deal.vendor_address_line1,
    },
    primaryPhotoUrl: photos[0]?.url ?? null,
    distanceMiles: null,
    headlineVariant: variants[0] ? toVariant(variants[0]) : null,
    variants: variants.map(toVariant),
    photos: photos.map((p) => ({
      id: p.id,
      url: p.url,
      photoType: p.photo_type,
      displayOrder: p.display_order,
    })),
    videos: videos.map((v) => ({
      id: v.id,
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url,
      caption: v.caption,
      durationSeconds: v.duration_seconds,
    })),
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      bio: p.bio,
      photoUrl: p.photo_url,
    })),
  };
}

async function fetchHeadlineVariants(sql: Sql, dealIds: string[]): Promise<Map<string, DealVariant>> {
  if (dealIds.length === 0) return new Map();
  const rows = await sql<(VariantRow & { deal_id: string })[]>`
    SELECT DISTINCT ON (deal_id)
      deal_id, id, label, unit_count, unit_label, original_price_cents, deal_price_cents,
      spots_total, spots_claimed
    FROM public.deal_variants
    WHERE deal_id = ANY(${sql.array(dealIds)}::uuid[]) AND active = true
    ORDER BY deal_id, display_order, label
  `;
  const map = new Map<string, DealVariant>();
  for (const r of rows) {
    map.set(r.deal_id, toVariant(r));
  }
  return map;
}

function toVariant(r: VariantRow): DealVariant {
  return {
    id: r.id,
    label: r.label,
    unitCount: r.unit_count,
    unitLabel: r.unit_label,
    originalPriceCents: r.original_price_cents,
    dealPriceCents: r.deal_price_cents,
    spotsTotal: r.spots_total,
    spotsClaimed: r.spots_claimed,
  };
}

// ============================================================
// Internal row types from SQL
// ============================================================

interface DealListRow {
  id: string;
  title: string;
  expires_at: string;
  is_sponsored: boolean;
  category_slug: string;
  category_display_name: string;
  subtype_slug: string | null;
  subtype_display_name: string | null;
  vendor_id: string;
  vendor_business_name: string;
  vendor_city: string;
  vendor_rating_avg: string | null;
  vendor_review_count: number;
  vendor_hours_summary: string | null;
  vendor_address_line1: string;
  primary_photo_url: string | null;
  distance_miles: string | null;
}

interface DealDetailRow extends Omit<DealListRow, 'primary_photo_url' | 'distance_miles'> {
  description: string;
  whats_included: unknown;
  restrictions: unknown;
  fine_print: string | null;
}

interface VariantRow {
  id: string;
  label: string;
  unit_count: number | null;
  unit_label: string | null;
  original_price_cents: number;
  deal_price_cents: number;
  spots_total: number | null;
  spots_claimed: number;
}

interface PhotoRow {
  id: string;
  url: string;
  photo_type: 'hero' | 'gallery' | 'before_after';
  display_order: number;
}

interface VideoRow {
  id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string | null;
  duration_seconds: number | null;
}

interface ProviderRow {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  photo_url: string | null;
}
