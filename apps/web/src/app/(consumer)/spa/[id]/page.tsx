import type { Metadata } from 'next';

import { JsonLd, breadcrumbLd, localBusinessLd } from '../../../../lib/jsonLd';
import { fetchStorefrontMeta } from '../../../../lib/serverApi';
import { SpaStorefrontClient } from './SpaStorefrontClient';

/**
 * Server wrapper for the spa storefront — emits SEO + social metadata, then
 * renders the interactive client island. Public + indexable.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchStorefrontMeta(id);
  if (!data) return { title: 'Spa' };

  const v = data.vendor;
  const title = `${v.businessName} — ${v.city}, ${v.region}`;
  const description = v.description?.slice(0, 155) ?? `Book beauty & wellness deals at ${v.businessName} in ${v.city} on Gloē.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(v.heroImageUrl ? { images: [{ url: v.heroImageUrl }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SpaStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Deduped with generateMetadata's fetch (same URL).
  const data = await fetchStorefrontMeta(id);

  return (
    <>
      {data ? (
        <JsonLd
          data={[
            localBusinessLd({
              id,
              name: data.vendor.businessName,
              description: data.vendor.description,
              image: data.vendor.heroImageUrl,
              url: data.vendor.website,
              phone: data.vendor.phone,
              address: {
                line1: data.vendor.addressLine1,
                line2: data.vendor.addressLine2,
                city: data.vendor.city,
                region: data.vendor.region,
                postalCode: data.vendor.postalCode,
              },
              geo: { lat: data.vendor.lat, lng: data.vendor.lng },
              gloe: { rating: data.vendor.ratingAvg, count: data.vendor.reviewCount },
              google: { rating: data.vendor.googleRating, count: data.vendor.googleReviewCount ?? 0 },
            }),
            breadcrumbLd([
              { name: 'Home', path: '/' },
              { name: data.vendor.businessName, path: `/spa/${id}` },
            ]),
          ]}
        />
      ) : null}
      <SpaStorefrontClient id={id} />
    </>
  );
}
