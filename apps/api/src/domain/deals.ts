import { detectTreatment, expandQuery, type DetectedTreatment } from './aestheticSynonyms';
import type { Sql } from '../db/client';
import { getTrendingConfig, type TrendingConfig } from './platformSettings';

/** Sort modes for the deal list / search. Default = relevance-blended ranking. */
export type DealSort = 'relevance' | 'distance' | 'price' | 'rating' | 'discount';

/**
 * Word-similarity floor for a fuzzy text match to count. Below this, only a
 * "hard" match (exact subtype/category or substring) keeps the deal. Tuned for
 * recall on typos ("botx"→botox) without pulling in unrelated deals.
 */
const SEARCH_SIM_THRESHOLD = 0.4;

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
  /** Live aggregate from Google Places (cached daily). Null if not linked. */
  googleRating: number | null;
  googleReviewCount: number | null;
  /**
   * Combined rating across Gloe + Google, weighted by review count.
   * Null only if neither has any reviews. Use this for the deal card header.
   */
  combinedRating: number | null;
  /** Total reviews across both sources. */
  combinedReviewCount: number;
  hoursSummary: string | null;
  address: string;
  /** Google Place ID, if known — enables the live Google reviews tab. */
  googlePlaceId: string | null;
  /** Vendor coordinates — used for client-side drive time estimates. */
  lat: number | null;
  lng: number | null;
}

export interface DealProvider {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  photoUrl: string | null;
}

/**
 * Mapper from a SQL row's vendor-prefixed columns to the DealVendor shape.
 * Lives near the type def so adding a vendor field is a one-spot change.
 * Combines Gloe + Google ratings using a count-weighted average — without
 * this, a vendor with 4.9★ on Google (200 reviews) and 4.0★ on Gloe (1 review)
 * would show as 4.0 on the card, misrepresenting the real signal.
 */
function mapVendor(r: {
  vendor_id: string;
  vendor_business_name: string;
  vendor_city: string;
  vendor_rating_avg: string | null;
  vendor_review_count: number;
  vendor_google_rating: string | null;
  vendor_google_review_count: number | null;
  vendor_hours_summary: string | null;
  vendor_address_line1: string;
  vendor_lat: number | null;
  vendor_lng: number | null;
}): DealVendor {
  const gloeRating = r.vendor_rating_avg !== null ? Number(r.vendor_rating_avg) : null;
  const googleRating = r.vendor_google_rating !== null ? Number(r.vendor_google_rating) : null;
  const gloeCount = r.vendor_review_count;
  const googleCount = r.vendor_google_review_count ?? 0;
  const totalCount = gloeCount + googleCount;
  const combinedRating = totalCount > 0
    ? ((gloeRating ?? 0) * gloeCount + (googleRating ?? 0) * googleCount) / totalCount
    : null;
  return {
    id: r.vendor_id,
    businessName: r.vendor_business_name,
    city: r.vendor_city,
    ratingAvg: gloeRating,
    reviewCount: gloeCount,
    googleRating,
    googleReviewCount: googleCount,
    combinedRating,
    combinedReviewCount: totalCount,
    hoursSummary: r.vendor_hours_summary,
    address: r.vendor_address_line1,
    googlePlaceId: null,
    lat: r.vendor_lat,
    lng: r.vendor_lng,
  };
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
  /** Drive duration in seconds (Google Distance Matrix, cached). Null if no
   *  user location, no vendor location, or Google failed. Mobile divides by 60
   *  to display "12 min drive." */
  driveSeconds: number | null;
  /** Headline variant (the first one) for feed display. */
  headlineVariant: DealVariant | null;
  /** Auto-computed: enough recent purchases to show the "Trending" ribbon. */
  isTrending: boolean;
}

export interface DealRedemption {
  /** Full address string, or null if the vendor has none on file. */
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** True when the deal overrides the vendor's business address. */
  isCustom: boolean;
  /** Cached static-map image URL (our storage), or null if not generated. */
  mapUrl: string | null;
}

export interface DealDetail extends DealSummary {
  description: string;
  whatsIncluded: string[];
  restrictions: string[];
  finePrint: string | null;
  /** Editorial "Gloē's take" on the spa (admin-written), shown on the deal page. */
  gloeTake: string | null;
  /** Quick "good to know" perk chips for the spa (admin-written). */
  gloePerks: string[];
  redemption: DealRedemption;
  variants: DealVariant[];
  photos: DealPhoto[];
  videos: DealVideo[];
  providers: DealProvider[];
  perCustomerLimit: number;
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
  offset?: number;
  /** Inclusive bounds on the cheapest variant of each deal, in cents. */
  minPriceCents?: number;
  maxPriceCents?: number;
  /** Minimum discount on the cheapest variant. 0-100; 30 = at least 30% off. */
  minDiscountPct?: number;
  /**
   * Free-text search query. When set, results are filtered to fuzzy + synonym
   * matches and (unless `sort` overrides) ranked by text relevance blended with
   * distance/rating/recency. Typo-tolerant ("botx") and slang-aware ("tox",
   * "skinny shot", "fat freeze") via the aesthetic synonym layer. See
   * `aestheticSynonyms.ts`.
   */
  q?: string;
  /** Restrict to a single treatment subtype by slug (e.g. "botox"). */
  subtypeSlug?: string;
  /** Minimum vendor rating (0-5). Falls back to Google rating when we have no native one. */
  minRating?: number;
  /** Result ordering. Defaults to relevance-blended ranking. */
  sort?: DealSort;
  /**
   * Pre-fetched trending config. When omitted, `listDeals` fetches it itself.
   * `getDiscoverFeed` fetches it ONCE and passes it to all rails so a single
   * feed request doesn't fire N identical settings queries (which drained the
   * DB pool). No caching — always a live read, just shared within one request.
   */
  trending?: TrendingConfig;
  /**
   * Seed for per-user-per-day jitter in the ranking. Pass the user id when
   * signed in, the device id (or any stable per-anon string) when not. Same
   * seed + same day = stable order; same seed next day = fresh order. Optional —
   * omitted means no jitter (deterministic distance + rating ordering).
   */
  viewerSeed?: string;
}

export interface DealPage {
  deals: DealSummary[];
  /** True if there are more deals past this page (for horizontal lazy-load). */
  hasMore: boolean;
  nextOffset: number;
}

export async function listDeals(sql: Sql, params: ListParams = {}): Promise<DealPage> {
  const {
    userLat, userLng, maxDistanceMiles = 50, category, limit = 50, offset = 0,
    minPriceCents, maxPriceCents, minDiscountPct, q, subtypeSlug, minRating, sort, viewerSeed,
  } = params;
  const hasUserLocation = typeof userLat === 'number' && typeof userLng === 'number';
  const radiusMeters = maxDistanceMiles * 1609.344;
  // Auto-"Trending" threshold (admin-tunable in god-mode). Use the caller's
  // pre-fetched config when provided (discoverFeed shares one across all rails).
  const trending = params.trending ?? await getTrendingConfig(sql);
  // Each of the three filters becomes part of a single EXISTS subquery so
  // we only require ONE matching variant (the cheapest) per deal — not all of them.
  const hasPriceMin = typeof minPriceCents === 'number';
  const hasPriceMax = typeof maxPriceCents === 'number';
  const hasDiscount = typeof minDiscountPct === 'number' && minDiscountPct > 0;
  const hasAnyVariantFilter = hasPriceMin || hasPriceMax || hasDiscount;
  const hasMinRating = typeof minRating === 'number' && minRating > 0;

  // ─── Search setup ───
  const expanded = q ? expandQuery(q) : null;
  const hasQuery = !!expanded && expanded.terms.length > 0;
  const terms = expanded?.terms ?? [];
  // Price/discount columns are needed to sort by them; always computed during
  // search so the result set can be re-sorted client-side without a refetch.
  const needsPriceCols = hasQuery || sort === 'price' || sort === 'discount';

  // Distance expression reused by both the SELECT projection and the ranking
  // penalty (matches the pre-existing pattern of computing it in both places).
  const distanceMilesExpr = hasUserLocation
    ? sql`ST_Distance(v.location, ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography) / 1609.344`
    : sql`NULL`;

  // Blended relevance score (higher = sooner). When searching, text relevance
  // dominates but distance/rating/recency still tie-break — so a strong match
  // nearby beats an equally-strong match across town. Sponsored boost is halved
  // during search so paid placement can't bury a better text match.
  const blendedScore = sql`(
    ${hasQuery ? sql`(rel.hard_match::int * 3.0) + (COALESCE(rel.sim, 0) * 5.0) + ` : sql``}
    (d.is_sponsored::int * ${hasQuery ? 1.0 : 2.0})
    + (COALESCE(v.rating_avg, 4.0) * 0.5)
    ${hasUserLocation ? sql`- LEAST((${distanceMilesExpr}) / 10.0, 5.0)` : sql``}
    + GREATEST(0.6 - (EXTRACT(EPOCH FROM (now() - d.created_at)) / 86400.0 / 50.0), 0)
    ${viewerSeed ? sql`+ ((abs(hashtext(${viewerSeed} || '|' || (now()::date)::text || '|' || d.id::text)) % 100) / 100.0 - 0.5)` : sql``}
  )`;

  // Sort override. Falls back to the blended score for 'relevance' (and for
  // 'distance' when we have no user location to sort by).
  const orderByClause =
    sort === 'distance' && hasUserLocation ? sql`distance_miles ASC NULLS LAST`
    : sort === 'price'    ? sql`min_price_cents ASC NULLS LAST`
    : sort === 'rating'   ? sql`COALESCE(v.rating_avg, v.google_rating, 0) DESC`
    : sort === 'discount' ? sql`max_discount_pct DESC NULLS LAST`
    : sql`${blendedScore} DESC`;

  const rows = await sql<DealListRow[]>`
    SELECT
      d.id,
      d.title,
      d.expires_at,
      d.is_sponsored,
      (
        SELECT COUNT(DISTINCT t.id) >= ${trending.minPurchases}
        FROM public.transactions t
        JOIN public.claims cl ON cl.transaction_id = t.id
        WHERE cl.deal_id = d.id
          AND t.status IN ('paid', 'released', 'partially_refunded')
          AND COALESCE(t.paid_at, t.created_at) >= now() - (${trending.windowDays} * INTERVAL '1 day')
      ) AS is_trending,
      c.slug          AS category_slug,
      c.display_name  AS category_display_name,
      s.slug          AS subtype_slug,
      s.display_name  AS subtype_display_name,
      v.id              AS vendor_id,
      v.business_name   AS vendor_business_name,
      v.city            AS vendor_city,
      v.rating_avg      AS vendor_rating_avg,
      v.review_count    AS vendor_review_count,
      v.google_rating   AS vendor_google_rating,
      v.google_review_count AS vendor_google_review_count,
      v.hours_summary   AS vendor_hours_summary,
      v.address_line1   AS vendor_address_line1,
      ST_Y(v.location::geometry) AS vendor_lat,
      ST_X(v.location::geometry) AS vendor_lng,
      (
        SELECT url FROM public.deal_photos p
        WHERE p.deal_id = d.id
        ORDER BY CASE WHEN p.photo_type = 'hero' THEN 0 ELSE 1 END, p.display_order
        LIMIT 1
      ) AS primary_photo_url,
      ${distanceMilesExpr} AS distance_miles
      ${hasQuery ? sql`, rel.sim AS relevance_sim, rel.hard_match AS hard_match` : sql``}
      ${needsPriceCols ? sql`,
        (SELECT MIN(dv.deal_price_cents) FROM public.deal_variants dv
          WHERE dv.deal_id = d.id AND dv.active = true) AS min_price_cents,
        (SELECT MAX(((dv.original_price_cents - dv.deal_price_cents)::float
                     / NULLIF(dv.original_price_cents, 0)) * 100)
          FROM public.deal_variants dv
          WHERE dv.deal_id = d.id AND dv.active = true) AS max_discount_pct
      ` : sql``}
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    JOIN public.service_categories c ON c.id = d.category_id
    LEFT JOIN public.service_subtypes s ON s.id = d.subtype_id
    ${
      hasQuery
        ? sql`
      LEFT JOIN LATERAL (
        SELECT
          MAX(GREATEST(
            word_similarity(t.term, lower(d.title)),
            word_similarity(t.term, lower(v.business_name)),
            word_similarity(t.term, lower(c.display_name)),
            word_similarity(t.term, lower(COALESCE(s.display_name, '')))
          )) AS sim,
          bool_or(
            lower(COALESCE(s.display_name, '')) = t.term
            OR lower(c.display_name) = t.term
            OR lower(d.title)            LIKE '%' || t.term || '%'
            OR lower(v.business_name)    LIKE '%' || t.term || '%'
            OR lower(COALESCE(s.display_name, '')) LIKE '%' || t.term || '%'
          ) AS hard_match
        FROM unnest(${sql.array(terms)}::text[]) AS t(term)
      ) rel ON true`
        : sql``
    }
    WHERE d.status = 'active'
      AND v.status = 'active'
      AND d.expires_at > now()
      ${category ? sql`AND (
        c.slug = ${category}
        OR EXISTS (
          SELECT 1 FROM public.service_categories c2
           WHERE c2.id = d.secondary_category_id AND c2.slug = ${category}
        )
      )` : sql``}
      ${
        hasUserLocation
          ? sql`AND ST_DWithin(
                v.location,
                ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
                ${radiusMeters}
              )`
          : sql``
      }
      ${
        hasAnyVariantFilter
          ? sql`AND EXISTS (
              SELECT 1 FROM public.deal_variants dv
              WHERE dv.deal_id = d.id
                AND dv.active = true
                ${hasPriceMin ? sql`AND dv.deal_price_cents >= ${minPriceCents}` : sql``}
                ${hasPriceMax ? sql`AND dv.deal_price_cents <= ${maxPriceCents}` : sql``}
                ${hasDiscount ? sql`AND dv.original_price_cents > 0
                  AND ((dv.original_price_cents - dv.deal_price_cents)::float / dv.original_price_cents) * 100 >= ${minDiscountPct}` : sql``}
            )`
          : sql``
      }
      ${subtypeSlug ? sql`AND s.slug = ${subtypeSlug}` : sql``}
      ${hasMinRating ? sql`AND COALESCE(v.rating_avg, v.google_rating, 0) >= ${minRating}` : sql``}
      ${hasQuery ? sql`AND (rel.sim >= ${SEARCH_SIM_THRESHOLD} OR rel.hard_match)` : sql``}
    -- Ranking via orderByClause: blended relevance score by default (text
    -- relevance + sponsored + rating - distance + recency + jitter), or a
    -- single-key override when the user picks a sort (distance/price/rating/discount).
    ORDER BY ${orderByClause}
    LIMIT ${limit + 1} OFFSET ${offset}
  `;

  // Fetched one extra to know if another page exists; trim it off.
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const dealIds = pageRows.map((r) => r.id);
  const headlineVariants = await fetchHeadlineVariants(sql, dealIds);

  const deals = pageRows.map((r) => {
    const miles = r.distance_miles !== null ? Number(r.distance_miles) : null;
    return {
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
      vendor: mapVendor(r),
      primaryPhotoUrl: r.primary_photo_url,
      distanceMiles: miles,
      driveSeconds: estimateDriveSeconds(miles),
      headlineVariant: headlineVariants.get(r.id) ?? null,
      isTrending: r.is_trending,
    };
  });

  return { deals, hasMore, nextOffset: offset + deals.length };
}

// ============================================================
// Discover feed — the whole "All" screen in ONE call
// ============================================================

export interface DiscoverRail {
  slug: string;
  displayName: string;
  deals: DealSummary[];
  hasMore: boolean;
  /** Curated "browse by category" tile image (shared with the web), or null to
   *  fall back to a deal photo client-side. Single source of truth so web + app
   *  show the identical tile. */
  tileImageUrl: string | null;
}

/**
 * Curated tile images per category — the SAME files the web serves from
 * /public/treatments. Built from PUBLIC_WEB_ORIGIN so both platforms read one
 * source. Categories not listed fall back to a deal photo (matches the web).
 */
const CURATED_TILE_SLUGS = new Set(['injectables', 'hormones-peptides']);
function curatedTileUrl(slug: string): string | null {
  if (!CURATED_TILE_SLUGS.has(slug)) return null;
  const origin = process.env.PUBLIC_WEB_ORIGIN ?? 'https://gloe.app';
  // The web stores peptides art under /treatments/peptides.jpg.
  const file = slug === 'hormones-peptides' ? 'peptides' : slug;
  return `${origin}/treatments/${file}.jpg`;
}

export interface DiscoverFeed {
  /** Sponsored deals for the top carousel. */
  featured: DealSummary[];
  /** One rail per category that has deals (empty rails are omitted). */
  rails: DiscoverRail[];
}

interface DiscoverFeedParams {
  userLat?: number;
  userLng?: number;
  maxDistanceMiles?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  minDiscountPct?: number;
  viewerSeed?: string;
  /** Deals per rail (the horizontal page size). */
  railLimit?: number;
}

/**
 * The Discover "All" view in a single round-trip. Previously the app fired one
 * `deals.list` per category rail (8+) plus a featured query — a fan-out that
 * drained the DB pool. This runs them all server-side concurrently and returns
 * the whole screen at once, so the client makes ONE request. Reuses `listDeals`
 * for identical ranking/shaping per rail.
 *
 * Cache-ready: the result is a pure function of (location bucket, filters,
 * viewerSeed, day) — a cache layer can wrap this later with no client change.
 */
export async function getDiscoverFeed(sql: Sql, params: DiscoverFeedParams = {}): Promise<DiscoverFeed> {
  const { railLimit = 8, ...shared } = params;

  // Fetch shared inputs ONCE, up front, so the rails don't each re-query them
  // (that fan-out — 9 rails × their own trending-config query — drained the
  // pool). No caching: a live read, just shared within this single request.
  const [cats, trending] = await Promise.all([
    sql<{ slug: string; display_name: string }[]>`
      SELECT slug, display_name
      FROM public.service_categories
      WHERE active = true
      ORDER BY display_order
    `,
    getTrendingConfig(sql),
  ]);

  // Fire featured + every category rail concurrently, each reusing the shared
  // trending config. The warm pool absorbs the burst.
  const [featuredPage, ...railPages] = await Promise.all([
    listDeals(sql, { ...shared, trending, limit: 10 }).then((p) => p.deals.filter((d) => d.isSponsored)),
    ...cats.map((c) =>
      listDeals(sql, { ...shared, trending, category: c.slug, limit: railLimit }).then((page) => ({
        slug: c.slug,
        displayName: c.display_name,
        deals: page.deals,
        hasMore: page.hasMore,
        tileImageUrl: curatedTileUrl(c.slug),
      })),
    ),
  ]);

  return {
    featured: featuredPage,
    // Drop empty rails so the client doesn't render bare headers.
    rails: (railPages as DiscoverRail[]).filter((r) => r.deals.length > 0),
  };
}

export interface SearchSuggestion {
  /** Display name, e.g. "Botox". */
  term: string;
  kind: 'subtype' | 'category';
  subtypeSlug: string | null;
  categorySlug: string;
  /** Active deals carrying this treatment (within radius if a location was passed). */
  dealCount: number;
}

/**
 * Autocomplete for the search box. Given a partial query, returns matching
 * treatment subtypes (fuzzy + synonym-expanded) ranked so suggestions that
 * actually have deals show first. Powers the type-ahead dropdown.
 */
export async function suggestSearchTerms(
  sql: Sql,
  raw: string,
  opts: { userLat?: number; userLng?: number; maxDistanceMiles?: number; limit?: number } = {},
): Promise<SearchSuggestion[]> {
  const { normalized, terms } = expandQuery(raw);
  if (!normalized) return [];
  const limit = Math.min(opts.limit ?? 8, 20);
  const radiusMeters = (opts.maxDistanceMiles ?? 50) * 1609.344;
  const lat = opts.userLat, lng = opts.userLng;
  const locFilter =
    typeof lat === 'number' && typeof lng === 'number'
      ? sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`
      : sql``;

  const rows = await sql<{
    term: string;
    subtype_slug: string;
    category_slug: string;
    deal_count: number;
    sim: string | null;
  }[]>`
    SELECT
      s.display_name AS term,
      s.slug         AS subtype_slug,
      c.slug         AS category_slug,
      (SELECT MAX(word_similarity(t.term, lower(s.display_name)))
         FROM unnest(${sql.array(terms)}::text[]) AS t(term)) AS sim,
      (SELECT COUNT(*) FROM public.deals d
         JOIN public.vendors v ON v.id = d.vendor_id
        WHERE d.subtype_id = s.id
          AND d.status = 'active' AND v.status = 'active' AND d.expires_at > now()
          ${locFilter}
      ) AS deal_count
    FROM public.service_subtypes s
    JOIN public.service_categories c ON c.id = s.category_id
    WHERE (SELECT MAX(word_similarity(t.term, lower(s.display_name)))
             FROM unnest(${sql.array(terms)}::text[]) AS t(term)) >= 0.3
       OR EXISTS (SELECT 1 FROM unnest(${sql.array(terms)}::text[]) AS t(term)
                   WHERE lower(s.display_name) LIKE '%' || t.term || '%')
    ORDER BY (deal_count > 0) DESC, sim DESC NULLS LAST, deal_count DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    term: r.term,
    kind: 'subtype' as const,
    subtypeSlug: r.subtype_slug,
    categorySlug: r.category_slug,
    dealCount: Number(r.deal_count),
  }));
}

/**
 * Zero-state chips for the search screen: the treatments with the most live
 * deals near the user. Inventory-based "popular" for now — swap to real
 * search/purchase counts once we log them.
 */
export async function getTrendingTreatments(
  sql: Sql,
  opts: { userLat?: number; userLng?: number; maxDistanceMiles?: number; limit?: number } = {},
): Promise<SearchSuggestion[]> {
  const limit = Math.min(opts.limit ?? 8, 20);
  const radiusMeters = (opts.maxDistanceMiles ?? 50) * 1609.344;
  const lat = opts.userLat, lng = opts.userLng;
  const locFilter =
    typeof lat === 'number' && typeof lng === 'number'
      ? sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`
      : sql``;

  const rows = await sql<{
    term: string;
    subtype_slug: string;
    category_slug: string;
    deal_count: number;
  }[]>`
    SELECT
      s.display_name AS term,
      s.slug         AS subtype_slug,
      c.slug         AS category_slug,
      COUNT(d.id)    AS deal_count
    FROM public.service_subtypes s
    JOIN public.service_categories c ON c.id = s.category_id
    JOIN public.deals d ON d.subtype_id = s.id AND d.status = 'active' AND d.expires_at > now()
    JOIN public.vendors v ON v.id = d.vendor_id AND v.status = 'active'
    ${locFilter}
    GROUP BY s.id, s.display_name, s.slug, c.slug
    ORDER BY deal_count DESC, s.display_name
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    term: r.term,
    kind: 'subtype' as const,
    subtypeSlug: r.subtype_slug,
    categorySlug: r.category_slug,
    dealCount: Number(r.deal_count),
  }));
}

/**
 * Treatments WITHIN a category that have enough nearby inventory to be worth
 * drilling into — powers the optional second row of "treatment" pills under a
 * selected category.
 *
 * The `minDeals` floor is the cold-start guard: we never surface a treatment
 * drill-down that would dead-end on a single result. With thin inventory this
 * returns few/none (so the UI stays category-only); as vendors are added,
 * treatments cross the floor and the drill-downs light up on their own — same
 * code, no flag to flip.
 */
export async function getCategoryTreatments(
  sql: Sql,
  categorySlug: string,
  opts: { userLat?: number; userLng?: number; maxDistanceMiles?: number; minDeals?: number } = {},
): Promise<SearchSuggestion[]> {
  const minDeals = opts.minDeals ?? 2;
  const radiusMeters = (opts.maxDistanceMiles ?? 50) * 1609.344;
  const lat = opts.userLat, lng = opts.userLng;
  const locFilter =
    typeof lat === 'number' && typeof lng === 'number'
      ? sql`AND ST_DWithin(v.location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`
      : sql``;

  const rows = await sql<{ term: string; subtype_slug: string; category_slug: string; deal_count: number }[]>`
    SELECT s.display_name AS term, s.slug AS subtype_slug, c.slug AS category_slug, COUNT(d.id) AS deal_count
    FROM public.service_subtypes s
    JOIN public.service_categories c ON c.id = s.category_id
    JOIN public.deals d ON d.subtype_id = s.id AND d.status = 'active' AND d.expires_at > now()
    JOIN public.vendors v ON v.id = d.vendor_id AND v.status = 'active'
    ${locFilter}
    WHERE c.slug = ${categorySlug}
    GROUP BY s.id, s.display_name, s.slug, c.slug
    HAVING COUNT(d.id) >= ${minDeals}
    ORDER BY deal_count DESC, s.display_name
  `;

  return rows.map((r) => ({
    term: r.term,
    kind: 'subtype' as const,
    subtypeSlug: r.subtype_slug,
    categorySlug: r.category_slug,
    dealCount: Number(r.deal_count),
  }));
}

/**
 * Detect the treatment subtype implied by some text (the deal title) against
 * the live taxonomy. Powers the post-deal form's auto-tag chip. Returns null if
 * nothing confidently lands.
 */
export async function detectSubtypeForText(
  sql: Sql,
  text: string,
  categorySlug?: string | null,
): Promise<DetectedTreatment | null> {
  if (!text || text.trim().length < 2) return null;
  const subtypes = await sql<{ slug: string; display_name: string; category_slug: string }[]>`
    SELECT s.slug, s.display_name, c.slug AS category_slug
    FROM public.service_subtypes s
    JOIN public.service_categories c ON c.id = s.category_id
  `;
  return detectTreatment(
    text,
    subtypes.map((s) => ({ slug: s.slug, displayName: s.display_name, categorySlug: s.category_slug })),
    categorySlug,
  );
}

export async function getDeal(sql: Sql, dealId: string): Promise<DealDetail | null> {
  const trending = await getTrendingConfig(sql);
  const dealRows = await sql<DealDetailRow[]>`
    SELECT
      d.id, d.title, d.description, d.whats_included, d.restrictions, d.fine_print,
      d.expires_at, d.is_sponsored, d.per_customer_limit,
      (
        SELECT COUNT(DISTINCT t.id) >= ${trending.minPurchases}
        FROM public.transactions t
        JOIN public.claims cl ON cl.transaction_id = t.id
        WHERE cl.deal_id = d.id
          AND t.status IN ('paid', 'released', 'partially_refunded')
          AND COALESCE(t.paid_at, t.created_at) >= now() - (${trending.windowDays} * INTERVAL '1 day')
      ) AS is_trending,
      d.redemption_address, d.redemption_lat, d.redemption_lng, d.redemption_map_url,
      c.slug AS category_slug, c.display_name AS category_display_name,
      s.slug AS subtype_slug, s.display_name AS subtype_display_name,
      v.id              AS vendor_id,
      v.business_name   AS vendor_business_name,
      v.city            AS vendor_city,
      v.rating_avg      AS vendor_rating_avg,
      v.review_count    AS vendor_review_count,
      v.google_rating   AS vendor_google_rating,
      v.google_review_count AS vendor_google_review_count,
      v.hours_summary   AS vendor_hours_summary,
      v.address_line1   AS vendor_address_line1,
      ST_Y(v.location::geometry) AS vendor_lat,
      ST_X(v.location::geometry) AS vendor_lng,
      v.google_place_id AS vendor_google_place_id,
      v.map_url       AS vendor_map_url,
      v.region        AS vendor_region,
      v.postal_code   AS vendor_postal_code,
      v.gloe_take     AS vendor_gloe_take,
      v.gloe_perks    AS vendor_gloe_perks,
      ST_Y(v.location::geometry) AS vendor_lat,
      ST_X(v.location::geometry) AS vendor_lng
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
    gloeTake: deal.vendor_gloe_take,
    gloePerks: deal.vendor_gloe_perks ?? [],
    isTrending: deal.is_trending,
    expiresAt: deal.expires_at,
    isSponsored: deal.is_sponsored,
    category: {
      slug: deal.category_slug,
      displayName: deal.category_display_name,
      subtypeSlug: deal.subtype_slug,
      subtypeDisplayName: deal.subtype_display_name,
    },
    vendor: { ...mapVendor(deal), googlePlaceId: deal.vendor_google_place_id ?? null },
    redemption: resolveRedemption(deal),
    primaryPhotoUrl: photos[0]?.url ?? null,
    distanceMiles: null,
    driveSeconds: null,
    headlineVariant: variants[0] ? toVariant(variants[0]) : null,
    variants: variants.map(toVariant),
    perCustomerLimit: deal.per_customer_limit,
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

/**
 * Estimate drive time from straight-line distance.
 *
 * Why not Google Distance Matrix: at $0.005 per (origin × destination) pair,
 * a 50-card feed costs $0.25 per user per day even with our cache. That
 * scales linearly with users and quickly outruns the platform fee margin.
 * DoorDash/Uber don't pay Google for this either — they self-host routing.
 *
 * Model: straight-line miles × ROAD_FACTOR ÷ AVG_MPH × 3600 = seconds.
 *
 * Critical detail — average speed depends on distance:
 *   • Under 3 mi   → ~22 mph (stop-and-go city, lights, parking)
 *   • 3–10 mi      → ~32 mph (mixed surface + a bit of highway)
 *   • 10–30 mi     → ~48 mph (mostly highway with on/off ramps)
 *   • 30+ mi       → ~55 mph (interstate cruise)
 *
 * A flat 28 mph would make a 24-mile trip look like 66 min (it's really
 * ~32 min). Tiering the speed keeps the estimate within ±20% of Google
 * across the range of distances we serve.
 */
function estimateDriveSeconds(miles: number | null): number | null {
  if (miles === null || miles < 0) return null;
  const ROAD_FACTOR = 1.3;     // road-network detour vs straight-line
  let mph: number;
  if (miles < 3) mph = 22;
  else if (miles < 10) mph = 32;
  else if (miles < 30) mph = 48;
  else mph = 55;
  const hours = (miles * ROAD_FACTOR) / mph;
  return Math.round(hours * 3600);
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

/**
 * Where the customer redeems. Uses the deal's explicit redemption location if
 * set, otherwise falls back to the vendor's business address + coordinates.
 */
function resolveRedemption(deal: DealDetailRow) {
  const hasCustom = deal.redemption_lat != null && deal.redemption_lng != null;
  const lat = hasCustom ? deal.redemption_lat : deal.vendor_lat;
  const lng = hasCustom ? deal.redemption_lng : deal.vendor_lng;
  const address = hasCustom
    ? (deal.redemption_address ?? '')
    : [deal.vendor_address_line1, deal.vendor_city, deal.vendor_region, deal.vendor_postal_code]
        .filter(Boolean)
        .join(', ');
  return {
    address: address || null,
    latitude: lat,
    longitude: lng,
    isCustom: hasCustom,
    // Deal-specific cached map, else the vendor's address map captured at signup.
    mapUrl: deal.redemption_map_url ?? deal.vendor_map_url,
  };
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
  vendor_google_rating: string | null;
  vendor_google_review_count: number | null;
  vendor_hours_summary: string | null;
  vendor_address_line1: string;
  vendor_lat: number | null;
  vendor_lng: number | null;
  primary_photo_url: string | null;
  distance_miles: string | null;
  is_trending: boolean;
  /** Present only on search queries (q set). */
  relevance_sim?: string | null;
  hard_match?: boolean | null;
  /** Present when sorting by / searching with price or discount. */
  min_price_cents?: number | null;
  max_discount_pct?: string | null;
}

interface DealDetailRow extends Omit<DealListRow, 'primary_photo_url' | 'distance_miles'> {
  description: string;
  whats_included: unknown;
  restrictions: unknown;
  fine_print: string | null;
  redemption_address: string | null;
  redemption_lat: number | null;
  redemption_lng: number | null;
  redemption_map_url: string | null;
  vendor_google_place_id: string | null;
  vendor_map_url: string | null;
  vendor_region: string | null;
  vendor_postal_code: string | null;
  vendor_lat: number | null;
  vendor_lng: number | null;
  vendor_gloe_take: string | null;
  vendor_gloe_perks: string[] | null;
  per_customer_limit: number;
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

/**
 * Distinct cities that currently have at least one live deal, busiest first.
 * Powers the consumer "coming soon" screen's dynamic "Now live in …" copy —
 * always accurate, auto-updates the moment a new city's first deal goes live.
 * The same predicate as the deals feed (active deal + active vendor + unexpired).
 */
export async function listLiveCities(sql: Sql): Promise<{ city: string; dealCount: number }[]> {
  const rows = await sql<{ city: string; deal_count: number }[]>`
    SELECT v.city AS city, count(*)::int AS deal_count
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    WHERE d.status = 'active'
      AND v.status = 'active'
      AND d.expires_at > now()
      AND v.city IS NOT NULL
      AND v.city <> ''
    GROUP BY v.city
    ORDER BY deal_count DESC, v.city ASC
  `;
  return rows.map((r) => ({ city: r.city, dealCount: r.deal_count }));
}
