import type { Metadata } from 'next';

import { JsonLd, breadcrumbLd, itemListLd } from '../../../../lib/jsonLd';
import { fetchCategory, fetchTreatmentDeals } from '../../../../lib/serverApi';
import { TreatmentClient } from './TreatmentClient';

/** Title-case a slug as a fallback when the category lookup misses. */
function titleize(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Server wrapper for a treatment (category) listing — the SEO money page for
 * "[treatment] near me" / "[treatment] deals" queries. Emits a unique title +
 * description and JSON-LD (ItemList of real inventory + breadcrumbs) so crawlers
 * see structured content without needing the user's geolocation, then hands off
 * to the interactive client island.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategory(slug);
  const name = category?.displayName ?? titleize(slug);
  const title = `${name} Deals Near You`;
  const description = `Book ${name.toLowerCase()} near you — compare vetted, top-rated medspas and save up to 60%. Voucher delivered instantly on Gloē.`;

  return {
    title,
    description,
    alternates: { canonical: `/treatments/${slug}` },
    openGraph: { title: `${title} · Gloē`, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: `${title} · Gloē`, description },
  };
}

export default async function TreatmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Category name (deduped with generateMetadata) + crawler-visible inventory.
  const [category, deals] = await Promise.all([fetchCategory(slug), fetchTreatmentDeals(slug)]);
  const name = category?.displayName ?? titleize(slug);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name, path: `/treatments/${slug}` },
          ]),
          ...(deals.length > 0
            ? [itemListLd(name, slug, deals.map((d) => ({ id: d.id, title: d.title, priceCents: d.headlineVariant?.dealPriceCents ?? null })))]
            : []),
        ]}
      />
      <TreatmentClient slug={slug} displayName={name} />
    </>
  );
}
