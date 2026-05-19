import type { Sql } from '../db/client';

export interface VendorDetail {
  id: string;
  businessName: string;
  slug: string;
  description: string | null;
  city: string;
  address: string;
  ratingAvg: number | null;
  reviewCount: number;
  hoursSummary: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
}

export async function getVendor(sql: Sql, vendorId: string): Promise<VendorDetail | null> {
  const rows = await sql<{
    id: string;
    business_name: string;
    slug: string;
    description: string | null;
    city: string;
    address_line1: string;
    rating_avg: string | null;
    review_count: number;
    hours_summary: string | null;
    hero_image_url: string | null;
    logo_url: string | null;
  }[]>`
    SELECT id, business_name, slug, description, city, address_line1,
           rating_avg, review_count, hours_summary, hero_image_url, logo_url
    FROM public.vendors
    WHERE id = ${vendorId} AND status = 'active'
    LIMIT 1
  `;
  const v = rows[0];
  if (!v) return null;
  return {
    id: v.id,
    businessName: v.business_name,
    slug: v.slug,
    description: v.description,
    city: v.city,
    address: v.address_line1,
    ratingAvg: v.rating_avg !== null ? Number(v.rating_avg) : null,
    reviewCount: v.review_count,
    hoursSummary: v.hours_summary,
    heroImageUrl: v.hero_image_url,
    logoUrl: v.logo_url,
  };
}
