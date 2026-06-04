import type { Sql, TxSql } from '../db/client';

export interface CreateDealVariantInput {
  label: string;
  unitCount?: number | null;
  unitLabel?: string | null;
  originalPriceCents: number;
  dealPriceCents: number;
  spotsTotal?: number | null;
}

export interface DealVideoInput {
  videoUrl: string;
  thumbnailUrl: string;
  caption?: string | null;
  durationSeconds?: number | null;
}

export interface CreateDealInput {
  vendorId: string;
  /** Primary category — drives the deal's home rail and main filter pill. */
  categoryId: string;
  /** Optional second category (1–2 categories per listing). */
  secondaryCategoryId?: string | null;
  /** Legacy: a subtype under the primary category. New form doesn't set this. */
  subtypeId?: string | null;
  title: string;
  description: string;
  whatsIncluded: string[];
  restrictions: string[];
  finePrint?: string | null;
  redemptionAddress?: string | null;
  redemptionLat?: number | null;
  redemptionLng?: number | null;
  startsAt?: string | null; // ISO; defaults to now
  expiresAt: string; // ISO
  perCustomerLimit: number;
  codeValidityDays: number;
  photoUrls: string[];
  videos?: DealVideoInput[];
  variants: CreateDealVariantInput[];
  /** When true, save as 'draft' instead of submitting for review. */
  asDraft?: boolean;
}

/**
 * Creates a deal + its variants + photos + videos in one transaction. Deals
 * submitted for review start as 'pending_review'; drafts start as 'draft'.
 */
export async function createDeal(sql: Sql, input: CreateDealInput): Promise<{ id: string }> {
  return sql.begin(async (tx) => {
    const status = input.asDraft ? 'draft' : 'pending_review';
    const dealRows = await tx<{ id: string }[]>`
      INSERT INTO public.deals (
        vendor_id, category_id, secondary_category_id, subtype_id,
        title, description, whats_included,
        status, starts_at, expires_at, per_customer_limit, code_validity_days,
        restrictions, fine_print,
        redemption_address, redemption_lat, redemption_lng
      ) VALUES (
        ${input.vendorId}, ${input.categoryId}, ${input.secondaryCategoryId ?? null}, ${input.subtypeId ?? null},
        ${input.title}, ${input.description}, ${tx.json(input.whatsIncluded)},
        ${status}, ${input.startsAt ?? tx`now()`}, ${input.expiresAt}, ${input.perCustomerLimit}, ${input.codeValidityDays},
        ${tx.json(input.restrictions)}, ${input.finePrint ?? null},
        ${input.redemptionAddress ?? null}, ${input.redemptionLat ?? null}, ${input.redemptionLng ?? null}
      )
      RETURNING id
    `;
    const deal = dealRows[0];
    if (!deal) throw new Error('Failed to create deal');

    await insertVariants(tx, deal.id, input.variants);
    await insertPhotos(tx, deal.id, input.photoUrls);
    await insertVideos(tx, deal.id, input.videos ?? []);

    return { id: deal.id };
  });
}

async function insertVariants(tx: TxSql, dealId: string, variants: CreateDealVariantInput[]) {
  let order = 0;
  for (const v of variants) {
    await tx`
      INSERT INTO public.deal_variants (
        deal_id, label, unit_count, unit_label, display_order,
        original_price_cents, deal_price_cents, spots_total, spots_claimed
      ) VALUES (
        ${dealId}, ${v.label}, ${v.unitCount ?? null}, ${v.unitLabel ?? null}, ${order},
        ${v.originalPriceCents}, ${v.dealPriceCents}, ${v.spotsTotal ?? null}, 0
      )
    `;
    order += 1;
  }
}

async function insertPhotos(tx: TxSql, dealId: string, photoUrls: string[]) {
  let order = 0;
  for (const url of photoUrls) {
    await tx`
      INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order)
      VALUES (${dealId}, ${url}, ${order === 0 ? 'hero' : 'gallery'}, ${order})
    `;
    order += 1;
  }
}

/**
 * Replace just a deal's photos, leaving everything else untouched. Used by the
 * admin quick-edit to remove / reorder / swap images without routing the deal
 * through the full re-review form. First URL becomes the hero (cover); the rest
 * are gallery, in array order. Photos have no downstream FKs — safe to wipe.
 */
export async function replaceDealPhotos(sql: Sql, dealId: string, photoUrls: string[]): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM public.deal_photos WHERE deal_id = ${dealId}`;
    await insertPhotos(tx, dealId, photoUrls);
  });
}

async function insertVideos(tx: TxSql, dealId: string, videos: DealVideoInput[]) {
  let order = 0;
  for (const v of videos) {
    await tx`
      INSERT INTO public.deal_videos (deal_id, video_url, thumbnail_url, caption, duration_seconds, display_order)
      VALUES (${dealId}, ${v.videoUrl}, ${v.thumbnailUrl}, ${v.caption ?? null}, ${v.durationSeconds ?? null}, ${order})
    `;
    order += 1;
  }
}

export interface UpdateDealInput extends Omit<CreateDealInput, 'vendorId' | 'asDraft'> {
  dealId: string;
  vendorId: string;
  /** Save as draft instead of (re)submitting for review. */
  asDraft?: boolean;
  /**
   * God-mode flag. When true, the deal keeps its current status instead of
   * being bounced to pending_review. Vendors NEVER set this; only the admin
   * router sets it via the admin.updateDeal procedure.
   */
  preserveStatus?: boolean;
}

/**
 * Replaces a deal's content + children. Editing a live (active) deal bounces it
 * back to 'pending_review' so an admin re-approves the changed content.
 * Drafts stay drafts unless submitted; everything else lands in pending_review.
 *
 * When `preserveStatus` is set (admin-only) the deal keeps its existing status —
 * admins can fix typos on live deals without disrupting the customer experience.
 */
export async function updateDeal(sql: Sql, input: UpdateDealInput): Promise<{ id: string; status: string }> {
  return sql.begin(async (tx) => {
    const current = await tx<{ status: string }[]>`
      SELECT status FROM public.deals WHERE id = ${input.dealId} AND vendor_id = ${input.vendorId} LIMIT 1
    `;
    const row = current[0];
    if (!row) throw new Error('Deal not found');
    if (row.status === 'expired' || row.status === 'sold_out') {
      throw new Error('This deal can no longer be edited.');
    }

    const nextStatus = input.preserveStatus
      ? row.status                                 // admin in-place edit
      : input.asDraft ? 'draft' : 'pending_review';

    // Vendor edits invalidate the approval record (so an admin re-reviews).
    // Admin edits preserve it (admins are already the approver).
    if (input.preserveStatus) {
      await tx`
        UPDATE public.deals SET
          category_id = ${input.categoryId},
          secondary_category_id = ${input.secondaryCategoryId ?? null},
          subtype_id = ${input.subtypeId ?? null},
          title = ${input.title},
          description = ${input.description},
          whats_included = ${tx.json(input.whatsIncluded)},
          restrictions = ${tx.json(input.restrictions)},
          fine_print = ${input.finePrint ?? null},
          redemption_address = ${input.redemptionAddress ?? null},
          redemption_lat = ${input.redemptionLat ?? null},
          redemption_lng = ${input.redemptionLng ?? null},
          starts_at = ${input.startsAt ?? tx`starts_at`},
          expires_at = ${input.expiresAt},
          per_customer_limit = ${input.perCustomerLimit},
          code_validity_days = ${input.codeValidityDays},
          updated_at = now()
        WHERE id = ${input.dealId}
      `;
    } else {
      await tx`
        UPDATE public.deals SET
          category_id = ${input.categoryId},
          secondary_category_id = ${input.secondaryCategoryId ?? null},
          subtype_id = ${input.subtypeId ?? null},
          title = ${input.title},
          description = ${input.description},
          whats_included = ${tx.json(input.whatsIncluded)},
          restrictions = ${tx.json(input.restrictions)},
          fine_print = ${input.finePrint ?? null},
          redemption_address = ${input.redemptionAddress ?? null},
          redemption_lat = ${input.redemptionLat ?? null},
          redemption_lng = ${input.redemptionLng ?? null},
          starts_at = ${input.startsAt ?? tx`starts_at`},
          expires_at = ${input.expiresAt},
          per_customer_limit = ${input.perCustomerLimit},
          code_validity_days = ${input.codeValidityDays},
          status = ${nextStatus},
          approved_by = NULL,
          approved_at = NULL,
          updated_at = now()
        WHERE id = ${input.dealId}
      `;
    }

    // Variants: soft-delete (active=false) any variant with existing claims;
    // hard-delete the rest. Claims reference deal_variants with ON DELETE
    // CASCADE — wiping variants would destroy paid customer vouchers.
    await tx`
      UPDATE public.deal_variants SET active = false
      WHERE deal_id = ${input.dealId}
        AND id IN (SELECT variant_id FROM public.claims WHERE variant_id IS NOT NULL)
    `;
    await tx`
      DELETE FROM public.deal_variants
      WHERE deal_id = ${input.dealId}
        AND id NOT IN (SELECT variant_id FROM public.claims WHERE variant_id IS NOT NULL)
    `;
    await insertVariants(tx, input.dealId, input.variants);

    // Photos and videos have no downstream FKs from customer activity — safe to wipe.
    await tx`DELETE FROM public.deal_photos WHERE deal_id = ${input.dealId}`;
    await tx`DELETE FROM public.deal_videos WHERE deal_id = ${input.dealId}`;
    await insertPhotos(tx, input.dealId, input.photoUrls);
    await insertVideos(tx, input.dealId, input.videos ?? []);

    return { id: input.dealId, status: nextStatus };
  });
}

/** Allowed status transitions a vendor can perform directly. */
const VENDOR_TRANSITIONS: Record<string, string[]> = {
  // pause a live deal; resume back to live
  active: ['paused'],
  paused: ['active'],
  // submit a draft for review
  draft: ['pending_review'],
};

/** Pause / resume / submit a deal. Validates the transition is allowed. */
export async function setDealStatus(
  sql: Sql,
  vendorId: string,
  dealId: string,
  to: string,
): Promise<{ id: string; status: string }> {
  const rows = await sql<{ status: string }[]>`
    SELECT status FROM public.deals WHERE id = ${dealId} AND vendor_id = ${vendorId} LIMIT 1
  `;
  const current = rows[0];
  if (!current) throw new Error('Deal not found');
  const allowed = VENDOR_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move a ${current.status} deal to ${to}.`);
  }
  await sql`UPDATE public.deals SET status = ${to}, updated_at = now() WHERE id = ${dealId}`;
  return { id: dealId, status: to };
}

/** Load a single deal (with children) owned by the vendor — for the edit form. */
export async function getVendorDeal(sql: Sql, vendorId: string, dealId: string) {
  const owns = await sql<{ id: string }[]>`
    SELECT id FROM public.deals WHERE id = ${dealId} AND vendor_id = ${vendorId} LIMIT 1
  `;
  if (owns.length === 0) return null;
  return loadDealDetail(sql, dealId);
}

/** Full deal detail by id (no vendor scope) — used by admin review. */
export async function getDealForReview(sql: Sql, dealId: string) {
  return loadDealDetail(sql, dealId);
}

async function loadDealDetail(sql: Sql, dealId: string) {
  const dealRows = await sql<{
    id: string;
    category_id: string;
    secondary_category_id: string | null;
    subtype_id: string | null;
    category_name: string;
    secondary_category_name: string | null;
    subtype_name: string | null;
    vendor_name: string;
    vendor_amenities: string[] | null;
    vendor_lat: number | null;
    vendor_lng: number | null;
    title: string;
    description: string;
    whats_included: string[];
    restrictions: string[];
    fine_print: string | null;
    redemption_address: string | null;
    redemption_lat: number | null;
    redemption_lng: number | null;
    status: string;
    starts_at: string;
    expires_at: string;
    per_customer_limit: number;
    code_validity_days: number;
  }[]>`
    SELECT d.id, d.category_id, d.secondary_category_id, d.subtype_id,
           c.display_name AS category_name,
           c2.display_name AS secondary_category_name,
           s.display_name AS subtype_name,
           v.business_name AS vendor_name, v.amenities AS vendor_amenities,
           ST_Y(v.location::geometry) AS vendor_lat, ST_X(v.location::geometry) AS vendor_lng,
           d.title, d.description, d.whats_included,
           d.restrictions, d.fine_print, d.redemption_address, d.redemption_lat, d.redemption_lng,
           d.status, d.starts_at, d.expires_at,
           d.per_customer_limit, d.code_validity_days
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    JOIN public.service_categories c ON c.id = d.category_id
    LEFT JOIN public.service_categories c2 ON c2.id = d.secondary_category_id
    LEFT JOIN public.service_subtypes s ON s.id = d.subtype_id
    WHERE d.id = ${dealId} LIMIT 1
  `;
  const deal = dealRows[0];
  if (!deal) return null;

  const variants = await sql<{
    label: string;
    unit_count: number | null;
    unit_label: string | null;
    original_price_cents: number;
    deal_price_cents: number;
    spots_total: number | null;
  }[]>`
    SELECT label, unit_count, unit_label, original_price_cents, deal_price_cents, spots_total
    FROM public.deal_variants WHERE deal_id = ${dealId} ORDER BY display_order
  `;
  const photos = await sql<{ url: string }[]>`
    SELECT url FROM public.deal_photos WHERE deal_id = ${dealId}
    ORDER BY CASE WHEN photo_type='hero' THEN 0 ELSE 1 END, display_order
  `;
  const videos = await sql<{
    video_url: string;
    thumbnail_url: string;
    caption: string | null;
    duration_seconds: number | null;
  }[]>`
    SELECT video_url, thumbnail_url, caption, duration_seconds
    FROM public.deal_videos WHERE deal_id = ${dealId} ORDER BY display_order
  `;

  return {
    id: deal.id,
    categoryId: deal.category_id,
    secondaryCategoryId: deal.secondary_category_id,
    /** Ordered [primary, secondary?] — what the form binds to. */
    categoryIds: deal.secondary_category_id
      ? [deal.category_id, deal.secondary_category_id]
      : [deal.category_id],
    subtypeId: deal.subtype_id,
    categoryName: deal.category_name,
    secondaryCategoryName: deal.secondary_category_name,
    subtypeName: deal.subtype_name,
    vendorName: deal.vendor_name,
    vendorAmenities: deal.vendor_amenities ?? [],
    vendorLat: deal.vendor_lat,
    vendorLng: deal.vendor_lng,
    title: deal.title,
    description: deal.description,
    whatsIncluded: deal.whats_included,
    restrictions: deal.restrictions,
    finePrint: deal.fine_print,
    redemptionAddress: deal.redemption_address,
    redemptionLat: deal.redemption_lat,
    redemptionLng: deal.redemption_lng,
    status: deal.status,
    startsAt: deal.starts_at,
    expiresAt: deal.expires_at,
    perCustomerLimit: deal.per_customer_limit,
    codeValidityDays: deal.code_validity_days,
    photoUrls: photos.map((p) => p.url),
    videos: videos.map((v) => ({
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url,
      caption: v.caption,
      durationSeconds: v.duration_seconds,
    })),
    variants: variants.map((v) => ({
      label: v.label,
      unitCount: v.unit_count,
      unitLabel: v.unit_label,
      originalPriceCents: v.original_price_cents,
      dealPriceCents: v.deal_price_cents,
      spotsTotal: v.spots_total,
    })),
  };
}

/** Flip any active/paused deal whose timer has passed to 'expired'. Returns count. */
export async function expireElapsedDeals(sql: Sql): Promise<number> {
  const rows = await sql<{ id: string }[]>`
    UPDATE public.deals
    SET status = 'expired', updated_at = now()
    WHERE status IN ('active', 'paused', 'pending_review') AND expires_at <= now()
    RETURNING id
  `;
  return rows.length;
}

/** Vendor's own deals (any status) for their dashboard. */
export async function listVendorDeals(sql: Sql, vendorId: string) {
  const rows = await sql<{
    id: string;
    title: string;
    status: string;
    starts_at: string;
    expires_at: string;
    category_name: string;
    primary_photo_url: string | null;
    headline_price_cents: number | null;
    variant_count: number;
    rejection_reason: string | null;
  }[]>`
    SELECT
      d.id, d.title, d.status, d.starts_at, d.expires_at, d.rejection_reason,
      c.display_name AS category_name,
      (SELECT url FROM public.deal_photos p WHERE p.deal_id = d.id
        ORDER BY CASE WHEN p.photo_type='hero' THEN 0 ELSE 1 END, p.display_order LIMIT 1) AS primary_photo_url,
      (SELECT MIN(deal_price_cents) FROM public.deal_variants dv WHERE dv.deal_id = d.id) AS headline_price_cents,
      (SELECT COUNT(*)::int FROM public.deal_variants dv WHERE dv.deal_id = d.id) AS variant_count
    FROM public.deals d
    JOIN public.service_categories c ON c.id = d.category_id
    WHERE d.vendor_id = ${vendorId}
    ORDER BY d.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    startsAt: r.starts_at,
    expiresAt: r.expires_at,
    categoryName: r.category_name,
    primaryPhotoUrl: r.primary_photo_url,
    headlinePriceCents: r.headline_price_cents,
    variantCount: r.variant_count,
    rejectionReason: r.rejection_reason,
  }));
}
