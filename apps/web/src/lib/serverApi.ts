/**
 * Tiny server-side reader for the public tRPC API — used by deal/spa pages'
 * `generateMetadata` to emit real <title>/OG tags for SEO + social previews.
 * Hits the same query procedures the client uses, over HTTP GET.
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

export interface DealMeta {
  title: string;
  description: string | null;
  category: { displayName: string; subtypeDisplayName: string | null };
  vendor: { businessName: string; city: string };
  primaryPhotoUrl: string | null;
}

export function fetchDealMeta(id: string) {
  return query<DealMeta>('deals.byId', { id });
}

export interface StorefrontMeta {
  vendor: { businessName: string; city: string; region: string; description: string | null; heroImageUrl: string | null };
}

export function fetchStorefrontMeta(id: string) {
  return query<StorefrontMeta>('vendors.storefront', { id });
}
