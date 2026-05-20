import type { Sql } from '../db/client';

export interface CreateDealVariantInput {
  label: string;
  unitCount?: number | null;
  unitLabel?: string | null;
  originalPriceCents: number;
  dealPriceCents: number;
  spotsTotal?: number | null;
}

export interface CreateDealInput {
  vendorId: string;
  categoryId: string;
  subtypeId?: string | null;
  title: string;
  description: string;
  whatsIncluded: string[];
  restrictions: string[];
  finePrint?: string | null;
  expiresAt: string; // ISO
  perCustomerLimit: number;
  codeValidityDays: number;
  photoUrls: string[];
  variants: CreateDealVariantInput[];
}

/**
 * Creates a deal + its variants + photos in one transaction. New deals start
 * as 'pending_review' so admin can moderate before they go live, EXCEPT we
 * could auto-approve trusted vendors later. For now: pending_review.
 */
export async function createDeal(sql: Sql, input: CreateDealInput): Promise<{ id: string }> {
  return sql.begin(async (tx) => {
    const dealRows = await tx<{ id: string }[]>`
      INSERT INTO public.deals (
        vendor_id, category_id, subtype_id,
        title, description, whats_included,
        status, expires_at, per_customer_limit, code_validity_days,
        restrictions, fine_print
      ) VALUES (
        ${input.vendorId}, ${input.categoryId}, ${input.subtypeId ?? null},
        ${input.title}, ${input.description}, ${tx.json(input.whatsIncluded)},
        'pending_review', ${input.expiresAt}, ${input.perCustomerLimit}, ${input.codeValidityDays},
        ${tx.json(input.restrictions)}, ${input.finePrint ?? null}
      )
      RETURNING id
    `;
    const deal = dealRows[0];
    if (!deal) throw new Error('Failed to create deal');

    // Variants
    let order = 0;
    for (const v of input.variants) {
      await tx`
        INSERT INTO public.deal_variants (
          deal_id, label, unit_count, unit_label, display_order,
          original_price_cents, deal_price_cents, spots_total, spots_claimed
        ) VALUES (
          ${deal.id}, ${v.label}, ${v.unitCount ?? null}, ${v.unitLabel ?? null}, ${order},
          ${v.originalPriceCents}, ${v.dealPriceCents}, ${v.spotsTotal ?? null}, 0
        )
      `;
      order += 1;
    }

    // Photos — first one is hero
    let photoOrder = 0;
    for (const url of input.photoUrls) {
      await tx`
        INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order)
        VALUES (${deal.id}, ${url}, ${photoOrder === 0 ? 'hero' : 'gallery'}, ${photoOrder})
      `;
      photoOrder += 1;
    }

    return { id: deal.id };
  });
}

/** Vendor's own deals (any status) for their dashboard. */
export async function listVendorDeals(sql: Sql, vendorId: string) {
  const rows = await sql<{
    id: string;
    title: string;
    status: string;
    expires_at: string;
    category_name: string;
    primary_photo_url: string | null;
    headline_price_cents: number | null;
    variant_count: number;
  }[]>`
    SELECT
      d.id, d.title, d.status, d.expires_at,
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
    expiresAt: r.expires_at,
    categoryName: r.category_name,
    primaryPhotoUrl: r.primary_photo_url,
    headlinePriceCents: r.headline_price_cents,
    variantCount: r.variant_count,
  }));
}
