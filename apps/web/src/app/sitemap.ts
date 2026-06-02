import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gloe.app';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Pull active deals from the public API to emit deal + spa URLs for SEO. */
async function fetchDealAndSpaRoutes(now: Date): Promise<MetadataRoute.Sitemap> {
  try {
    const input = encodeURIComponent(JSON.stringify({ limit: 100 }));
    const res = await fetch(`${API_URL}/trpc/deals.list?input=${input}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: { data?: { deals?: { id: string; vendor: { id: string } }[] } } };
    const deals = json.result?.data?.deals ?? [];
    const spaIds = new Set<string>();
    const dealRoutes = deals.map((d) => {
      spaIds.add(d.vendor.id);
      return { url: `${SITE_URL}/deals/${d.id}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.8 };
    });
    const spaRoutes = [...spaIds].map((id) => ({
      url: `${SITE_URL}/spa/${id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
    return [...dealRoutes, ...spaRoutes];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const dynamic = await fetchDealAndSpaRoutes(now);
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/business`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/sign-in`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/sign-up`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    ...dynamic,
  ];
}
