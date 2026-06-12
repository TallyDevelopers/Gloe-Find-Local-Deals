import type { Sql } from '../db/client';
import { cacheVendorMap } from './dealMap';

/**
 * Version of the Vendor Agreement at /legal/vendor-terms (GLO-35). Bump when
 * the agreement materially changes so we know which version each vendor
 * accepted.
 */
export const VENDOR_TERMS_VERSION = '2026-06-11';

export interface VendorSignupInput {
  /** Null for admin-created (unclaimed) vendors; the spa claims it later. */
  ownerUserId: string | null;
  businessName: string;
  phone: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  googlePlaceId?: string | null;
  categorySlugs: string[];
  /** True only for owner self-signup, where the agreement checkbox is required. */
  acceptedTerms?: boolean;
}

export interface VendorRecord {
  id: string;
  businessName: string;
  slug: string;
  status: string;
  /** Business address — present on getVendorForOwner, used as the default redemption location. */
  address?: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Creates a vendor in `pending_approval` status from the minimal signup form.
 * License, providers, photos, and Stripe Connect are completed later before
 * the vendor can take a deal live.
 */
export async function createVendor(sql: Sql, input: VendorSignupInput): Promise<VendorRecord> {
  // Ensure unique slug
  const base = slugify(input.businessName) || 'vendor';
  let slug = base;
  let attempt = 1;
  while (true) {
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM public.vendors WHERE slug = ${slug} LIMIT 1
    `;
    if (existing.length === 0) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  const inserted = await sql<{ id: string; business_name: string; slug: string; status: string }[]>`
    INSERT INTO public.vendors (
      owner_user_id, business_name, slug, phone,
      address_line1, city, region, postal_code, country,
      location, google_place_id, status,
      terms_accepted_at, terms_version
    ) VALUES (
      ${input.ownerUserId}, ${input.businessName}, ${slug}, ${input.phone},
      ${input.addressLine1}, ${input.city}, ${input.region}, ${input.postalCode}, 'US',
      ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography,
      ${input.googlePlaceId ?? null}, 'pending_approval',
      ${input.acceptedTerms ? new Date() : null}, ${input.acceptedTerms ? VENDOR_TERMS_VERSION : null}
    )
    RETURNING id, business_name, slug, status
  `;
  const vendor = inserted[0];
  if (!vendor) throw new Error('Failed to create vendor');

  // Link service categories
  if (input.categorySlugs.length > 0) {
    await sql`
      INSERT INTO public.vendor_services (vendor_id, category_id)
      SELECT ${vendor.id}, c.id
      FROM public.service_categories c
      WHERE c.slug = ANY(${sql.array(input.categorySlugs)})
      ON CONFLICT DO NOTHING
    `;
  }

  // Capture a cached map snapshot of the address now, so the profile + any deal
  // always have a real map. Best-effort: a failure never blocks signup.
  try {
    const mapUrl = await cacheVendorMap(vendor.id, input.latitude, input.longitude);
    if (mapUrl) {
      await sql`UPDATE public.vendors SET map_url = ${mapUrl} WHERE id = ${vendor.id}`;
    }
  } catch {
    /* non-fatal */
  }

  return {
    id: vendor.id,
    businessName: vendor.business_name,
    slug: vendor.slug,
    status: vendor.status,
  };
}

/** The vendor owned by the current user, if any. */
export async function getVendorForOwner(sql: Sql, ownerUserId: string): Promise<VendorRecord | null> {
  const rows = await sql<{
    id: string;
    business_name: string;
    slug: string;
    status: string;
    address_line1: string;
    city: string;
    region: string;
    postal_code: string;
    lat: number | null;
    lng: number | null;
  }[]>`
    SELECT id, business_name, slug, status,
           address_line1, city, region, postal_code,
           ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM public.vendors
    WHERE owner_user_id = ${ownerUserId}
    LIMIT 1
  `;
  const v = rows[0];
  if (!v) return null;
  return {
    id: v.id,
    businessName: v.business_name,
    slug: v.slug,
    status: v.status,
    address: {
      line1: v.address_line1,
      city: v.city,
      region: v.region,
      postalCode: v.postal_code,
      latitude: v.lat,
      longitude: v.lng,
    },
  };
}

export interface VendorSetupStatus {
  status: string;
  isApproved: boolean;
  steps: {
    businessDetails: boolean;
    license: boolean;   // REQUIRED to post
    stripe: boolean;    // REQUIRED to post
    provider: boolean;  // nice-to-have
    photos: boolean;    // nice-to-have
  };
  canPostDeals: boolean;
}

/**
 * Computes setup completion from existing columns + related rows.
 * Required-to-post = approved + license verified + Stripe active.
 */
export async function getSetupStatus(
  sql: Sql,
  ownerUserId: string,
): Promise<VendorSetupStatus | null> {
  const rows = await sql<{
    status: string;
    license_status: string;
    stripe_account_status: string | null;
    logo_url: string | null;
    hero_image_url: string | null;
    admin_bypass: boolean;
    provider_count: number;
  }[]>`
    SELECT
      v.status, v.license_status,
      v.stripe_account_status, v.logo_url, v.hero_image_url, v.admin_bypass,
      (SELECT COUNT(*) FROM public.providers p WHERE p.vendor_id = v.id)::int AS provider_count
    FROM public.vendors v
    WHERE v.owner_user_id = ${ownerUserId}
    LIMIT 1
  `;
  const v = rows[0];
  if (!v) return null;

  // GLO-19: the license step is done only when an admin verified it.
  const license = v.license_status === 'verified';
  const stripe = v.stripe_account_status === 'active';
  const provider = v.provider_count > 0;
  const photos = Boolean(v.logo_url || v.hero_image_url);
  const isApproved = v.status === 'active';

  return {
    status: v.status,
    isApproved,
    steps: { businessDetails: true, license, stripe, provider, photos },
    // Admin bypass lets a founder-onboarded spa post without license/Stripe yet.
    canPostDeals: v.admin_bypass || (isApproved && license && stripe),
  };
}
