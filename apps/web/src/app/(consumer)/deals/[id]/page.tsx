import type { Metadata } from 'next';

import { fetchDealMeta } from '../../../../lib/serverApi';
import { DealDetailClient } from './DealDetailClient';

/**
 * Server wrapper for the deal page. Fetches the deal server-side purely to emit
 * SEO + social metadata (<title>, description, OG image), then hands off to the
 * interactive client island. Public + indexable.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const deal = await fetchDealMeta(id);
  if (!deal) return { title: 'Deal' };

  const treatment = deal.category.subtypeDisplayName ?? deal.category.displayName;
  const title = `${deal.title} · ${deal.vendor.businessName}`;
  const description =
    deal.description?.slice(0, 155) ??
    `${treatment} at ${deal.vendor.businessName} in ${deal.vendor.city} — book on Gloē.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(deal.primaryPhotoUrl ? { images: [{ url: deal.primaryPhotoUrl }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealDetailClient id={id} />;
}
