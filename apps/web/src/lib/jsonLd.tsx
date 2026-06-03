/**
 * Structured data (schema.org JSON-LD) for rich Google results. Each builder
 * returns a plain object; <JsonLd> serializes it into a script tag. Keeping the
 * builders pure makes them trivial to unit-test and reuse across server pages.
 *
 * Why this matters for a local deals marketplace:
 *  - Product + Offer  → price shows directly in search results
 *  - AggregateRating  → ★ star snippets (big CTR lift)
 *  - LocalBusiness    → local pack / Google Maps eligibility
 *  - BreadcrumbList    → breadcrumb trail under the result
 *  - WebSite+Search   → sitelinks search box
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gloe.app').replace(/\/$/, '');

/** Renders one or more JSON-LD blobs. Safe: we JSON.stringify (no raw HTML). */
export function JsonLd({ data }: { data: object | object[] }) {
  const blobs = Array.isArray(data) ? data : [data];
  return (
    <>
      {blobs.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  );
}

const abs = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path}`);
const dollars = (cents: number) => (cents / 100).toFixed(2);

/** Combine Gloē + Google ratings into one weighted aggregate for schema. */
function combineRatings(
  a: { rating: number | null; count: number },
  b: { rating: number | null; count: number },
): { ratingValue: number; reviewCount: number } | null {
  const parts = [a, b].filter((p) => p.rating != null && p.count > 0) as { rating: number; count: number }[];
  if (parts.length === 0) return null;
  const total = parts.reduce((n, p) => n + p.count, 0);
  const weighted = parts.reduce((n, p) => n + p.rating * p.count, 0) / total;
  return { ratingValue: Math.round(weighted * 10) / 10, reviewCount: total };
}

/* --------------------------------- builders -------------------------------- */

/** Sitewide brand identity. */
export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Gloē',
    url: SITE_URL,
    logo: abs('/icon.svg'),
    description:
      'Gloē is a marketplace for vetted beauty & wellness — book botox, fillers, facials, and laser at top-rated medspas near you.',
    sameAs: [] as string[],
  };
}

/** WebSite node with a SearchAction → enables the Google sitelinks search box. */
export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Gloē',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}
export function breadcrumbLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export interface ProductLdInput {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  treatment: string;
  vendorName: string;
  priceCents: number | null;
  expiresAt: string | null;
  rating: { value: number | null; count: number } | null;
}
/** A deal → Product with an Offer (price) and optional AggregateRating. */
export function productLd(d: ProductLdInput) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: d.title,
    category: d.treatment,
    url: abs(`/deals/${d.id}`),
    ...(d.description ? { description: d.description.slice(0, 5000) } : {}),
    ...(d.image ? { image: [d.image] } : {}),
    brand: { '@type': 'Brand', name: d.vendorName },
  };
  if (d.priceCents != null) {
    ld.offers = {
      '@type': 'Offer',
      price: dollars(d.priceCents),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: abs(`/deals/${d.id}`),
      seller: { '@type': 'Organization', name: d.vendorName },
      ...(d.expiresAt ? { priceValidUntil: d.expiresAt.slice(0, 10) } : {}),
    };
  }
  if (d.rating && d.rating.value != null && d.rating.count > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: d.rating.value,
      reviewCount: d.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return ld;
}

export interface LocalBusinessLdInput {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  url: string | null;
  phone: string | null;
  address: { line1: string; line2: string | null; city: string; region: string; postalCode: string };
  geo: { lat: number | null; lng: number | null };
  gloe: { rating: number | null; count: number };
  google: { rating: number | null; count: number };
}
/** A spa storefront → HealthAndBeautyBusiness (a LocalBusiness subtype). */
export function localBusinessLd(v: LocalBusinessLdInput) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    '@id': abs(`/spa/${v.id}`),
    name: v.name,
    url: abs(`/spa/${v.id}`),
    ...(v.description ? { description: v.description.slice(0, 5000) } : {}),
    ...(v.image ? { image: [v.image] } : {}),
    ...(v.phone ? { telephone: v.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: [v.address.line1, v.address.line2].filter(Boolean).join(', '),
      addressLocality: v.address.city,
      addressRegion: v.address.region,
      postalCode: v.address.postalCode,
      addressCountry: 'US',
    },
  };
  if (v.geo.lat != null && v.geo.lng != null) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: v.geo.lat, longitude: v.geo.lng };
  }
  const rating = combineRatings(
    { rating: v.gloe.rating, count: v.gloe.count },
    { rating: v.google.rating, count: v.google.count },
  );
  if (rating) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.ratingValue,
      reviewCount: rating.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  return ld;
}

export interface ItemListEntry {
  id: string;
  title: string;
  priceCents: number | null;
}
/** A treatment listing → ItemList of deals so Google sees real inventory. */
export function itemListLd(treatment: string, slug: string, deals: ItemListEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${treatment} deals near you`,
    url: abs(`/treatments/${slug}`),
    numberOfItems: deals.length,
    itemListElement: deals.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(`/deals/${d.id}`),
      name: d.title,
    })),
  };
}
