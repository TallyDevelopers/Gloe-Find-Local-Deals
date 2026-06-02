'use client';

import { useAuth } from '@clerk/nextjs';
import type { RouterOutputs } from '@gloe/api-client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Stars } from '../../../../components/consumer/Stars';
import { Globe, Heart, Instagram, MapPin, Navigation, Phone } from '../../../../components/consumer/icons';
import { formatPrice } from '../../../../components/consumer/format';
import { trpc } from '../../../../lib/trpc';

type Storefront = RouterOutputs['vendors']['storefront'];

export function SpaStorefrontClient({ id }: { id: string }) {
  const router = useRouter();
  const store = trpc.vendors.storefront.useQuery({ id }, { enabled: !!id });

  if (store.isLoading) return <Loading />;
  if (store.error || !store.data) return <NotFound />;

  const { vendor, providers, activeDeals, videos, gloeReviews, googleReviews } = store.data;
  const fullAddress = [vendor.addressLine1, vendor.city, vendor.region].filter(Boolean).join(', ');
  const directionsHref =
    vendor.lat != null && vendor.lng != null
      ? `https://maps.apple.com/?daddr=${vendor.lat},${vendor.lng}`
      : `https://maps.apple.com/?q=${encodeURIComponent(fullAddress)}`;

  return (
    <div>
      {/* Hero */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 6', minHeight: 220, maxHeight: 380, background: 'var(--surface-secondary)', overflow: 'hidden' }}>
        {vendor.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vendor.heroImageUrl} alt={vendor.businessName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px',
              textAlign: 'center',
              background: 'radial-gradient(700px 300px at 30% 20%, var(--accent-500), transparent 70%), linear-gradient(135deg, var(--brand-500), var(--gold-deep))',
            }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500, color: 'var(--text-inverse)' }}>{vendor.businessName}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          style={{ position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-elevated)', border: 'none', boxShadow: '0 2px 12px rgba(43,32,25,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, color: 'var(--text-primary)' }}
        >
          ←
        </button>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <SaveVendorButton vendorId={vendor.id} />
        </div>
      </div>

      <div className="consumer-container" style={{ maxWidth: 1000, paddingTop: 24 }}>
        {/* Title + ratings */}
        <h1 style={{ fontSize: 36, lineHeight: 1.1 }}>{vendor.businessName}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: 14.5 }}>
          {vendor.ratingAvg != null && vendor.reviewCount > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Stars value={vendor.ratingAvg} /> {vendor.ratingAvg.toFixed(1)} ({vendor.reviewCount}) on Gloē
            </span>
          ) : null}
          {vendor.googleRating != null && (vendor.googleReviewCount ?? 0) > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Stars value={vendor.googleRating} /> {vendor.googleRating.toFixed(1)} ({vendor.googleReviewCount}) on Google
            </span>
          ) : null}
          {fullAddress ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={15} /> {vendor.city}, {vendor.region}
            </span>
          ) : null}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <ActionButton href={directionsHref} icon={<Navigation size={16} color="var(--brand-600)" />}>Directions</ActionButton>
          {vendor.phone ? <ActionButton href={`tel:${vendor.phone}`} icon={<Phone size={16} color="var(--brand-600)" />}>Call</ActionButton> : null}
          {vendor.website ? <ActionButton href={vendor.website} icon={<Globe size={16} color="var(--brand-600)" />}>Website</ActionButton> : null}
          {vendor.instagramHandle ? (
            <ActionButton href={`https://instagram.com/${vendor.instagramHandle.replace(/^@/, '')}`} icon={<Instagram size={16} color="var(--brand-600)" />}>
              Instagram
            </ActionButton>
          ) : null}
        </div>

        {vendor.description ? (
          <Section title="About">
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{vendor.description}</p>
          </Section>
        ) : null}

        {vendor.amenities.length > 0 ? (
          <Section title="What to expect">
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {vendor.amenities.map((a) => (
                <span key={a} style={{ fontSize: 13.5, fontWeight: 500, padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
                  {a}
                </span>
              ))}
            </div>
          </Section>
        ) : null}

        {providers.length > 0 ? (
          <Section title="Your providers">
            <div className="hide-scrollbar" style={{ display: 'flex', gap: 18, overflowX: 'auto' }}>
              {providers.map((p) => (
                <div key={p.id} style={{ width: 130, flexShrink: 0, textAlign: 'center' }}>
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', margin: '0 auto' }} />
                  ) : (
                    <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--brand-100)', margin: '0 auto' }} />
                  )}
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{p.title}</div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {activeDeals.length > 0 ? (
          <Section title="Active deals">
            <div className="deal-grid">
              {activeDeals.map((deal) => (
                <ActiveDealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Active deals">
            <p style={{ color: 'var(--text-tertiary)' }}>No active deals right now — check back soon.</p>
          </Section>
        )}

        {videos.length > 0 ? (
          <Section title="Inside the spa">
            <div className="hide-scrollbar" style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
              {videos.map((v) => (
                <a key={v.id} href={v.videoUrl} target="_blank" rel="noreferrer" style={{ width: 200, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumbnailUrl} alt={v.caption ?? ''} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                </a>
              ))}
            </div>
          </Section>
        ) : null}

        {gloeReviews.length > 0 ? (
          <Section title="Reviews on Gloē">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {gloeReviews.map((r) => (
                <div key={r.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stars value={r.rating} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.authorFirstName ?? 'Guest'}</span>
                  </div>
                  {r.body ? <p style={{ color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>{r.body}</p> : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {googleReviews.length > 0 ? (
          <Section title="Reviews on Google">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {googleReviews.map((r, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stars value={r.rating} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.authorName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {r.relativeTime}</span>
                  </div>
                  {r.text ? <p style={{ color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>{r.text}</p> : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function ActiveDealCard({ deal }: { deal: Storefront['activeDeals'][number] }) {
  const pct =
    deal.minOriginalPriceCents && deal.minDealPriceCents
      ? Math.round(((deal.minOriginalPriceCents - deal.minDealPriceCents) / deal.minOriginalPriceCents) * 100)
      : 0;
  return (
    <Link href={`/deals/${deal.id}`} className="deal-card" style={{ display: 'block', color: 'inherit' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: 'var(--surface-secondary)' }}>
        {deal.primaryPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deal.primaryPhotoUrl} alt={deal.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        {pct > 0 ? (
          <span style={{ position: 'absolute', top: 10, left: 10, background: 'var(--brand-500)', color: 'var(--text-inverse)', fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 'var(--radius-pill)' }}>
            {pct}% off
          </span>
        ) : null}
      </div>
      <div style={{ padding: '12px 14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>{deal.categoryName}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.title}</div>
        {deal.minDealPriceCents != null ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>from {formatPrice(deal.minDealPriceCents)}</span>
            {deal.minOriginalPriceCents && pct > 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{formatPrice(deal.minOriginalPriceCents)}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function SaveVendorButton({ vendorId }: { vendorId: string }) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const utils = trpc.useUtils();
  const ids = trpc.saved.listVendorIds.useQuery(undefined, { enabled: !!isSignedIn });
  const toggle = trpc.saved.toggleVendor.useMutation({ onSettled: () => utils.saved.listVendorIds.invalidate() });
  const saved = ids.data?.includes(vendorId) ?? false;

  return (
    <button
      type="button"
      aria-label={saved ? 'Unsave spa' : 'Save spa'}
      onClick={() => {
        if (!isSignedIn) return router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        toggle.mutate({ vendorId });
      }}
      style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface-elevated)', border: 'none', boxShadow: '0 2px 12px rgba(43,32,25,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    >
      <Heart size={20} color={saved ? 'var(--accent-500)' : 'var(--text-primary)'} fill={saved ? 'var(--accent-500)' : 'none'} strokeWidth={2.25} />
    </button>
  );
}

function ActionButton({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}
    >
      {icon} {children}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ paddingTop: 28, marginTop: 28, borderTop: '1px solid var(--border-subtle)' }}>
      <h2 style={{ fontSize: 22, marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div>
      <div style={{ width: '100%', aspectRatio: '16 / 6', minHeight: 220, maxHeight: 380, background: 'var(--surface-secondary)' }} />
      <div className="consumer-container" style={{ maxWidth: 1000, paddingTop: 24 }}>
        <div style={{ height: 32, width: '50%', borderRadius: 8, background: 'var(--surface-secondary)' }} />
        <div style={{ height: 16, width: '35%', marginTop: 12, borderRadius: 8, background: 'var(--surface-secondary)' }} />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="consumer-container" style={{ paddingTop: 80, textAlign: 'center' }}>
      <h1 style={{ fontSize: 28 }}>Spa not found</h1>
      <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--brand-600)', fontWeight: 600 }}>
        ← Back to deals
      </Link>
    </div>
  );
}
