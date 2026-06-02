import type { Metadata } from 'next';

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
  return <SpaStorefrontClient id={id} />;
}
