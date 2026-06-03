/**
 * Server-side reader for the public tRPC API — used by page-level
 * `generateMetadata` and JSON-LD structured data to emit real SEO. Hits the
 * same public query procedures the client uses, over HTTP GET, with ISR caching.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function query<T>(path: string, input: unknown): Promise<T | null> {
  try {
    const url = `${API_URL}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { data?: T } };
    return json.result?.data ?? null;
  } catch {
    return null;
  }
}

/* --------------------------------- deals ---------------------------------- */

/** Subset of `deals.byId` (DealDetail) we use for metadata + Product JSON-LD. */
export interface DealMeta {
  id: string;
  title: string;
  description: string | null;
  category: { displayName: string; subtypeDisplayName: string | null; slug: string };
  vendor: {
    id: string;
    businessName: string;
    city: string;
    address: string;
    lat: number | null;
    lng: number | null;
    combinedRating: number | null;
    combinedReviewCount: number;
  };
  primaryPhotoUrl: string | null;
  expiresAt: string | null;
  headlineVariant: { dealPriceCents: number; originalPriceCents: number } | null;
}

export function fetchDealMeta(id: string) {
  return query<DealMeta>('deals.byId', { id });
}

/* ------------------------------- storefront ------------------------------- */

/** Subset of `vendors.storefront` for metadata + LocalBusiness JSON-LD. */
export interface StorefrontMeta {
  vendor: {
    id: string;
    businessName: string;
    description: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    region: string;
    postalCode: string;
    phone: string | null;
    website: string | null;
    heroImageUrl: string | null;
    lat: number | null;
    lng: number | null;
    ratingAvg: number | null;
    reviewCount: number;
    googleRating: number | null;
    googleReviewCount: number | null;
  };
}

export function fetchStorefrontMeta(id: string) {
  return query<StorefrontMeta>('vendors.storefront', { id });
}

/* ------------------------------- categories ------------------------------- */

export interface CategoryMeta {
  slug: string;
  displayName: string;
}

export async function fetchCategory(slug: string): Promise<CategoryMeta | null> {
  const cats = await query<CategoryMeta[]>('categories.list', {});
  return cats?.find((c) => c.slug === slug) ?? null;
}

/* ----------------------- treatment listing (ItemList) --------------------- */

export interface TreatmentDeal {
  id: string;
  title: string;
  headlineVariant: { dealPriceCents: number } | null;
}

/** Deals for a category WITHOUT a user location — crawler-visible inventory. */
export async function fetchTreatmentDeals(slug: string): Promise<TreatmentDeal[]> {
  const data = await query<{ deals: TreatmentDeal[] }>('deals.list', { category: slug, limit: 24 });
  return data?.deals ?? [];
}
