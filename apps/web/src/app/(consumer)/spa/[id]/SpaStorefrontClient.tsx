'use client';

import { useAuth } from '@clerk/nextjs';
import type { RouterOutputs } from '@gloe/api-client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Carousel } from '../../../../components/consumer/Carousel';
import { Stars } from '../../../../components/consumer/Stars';
import { Clock, Globe, Heart, Instagram, MapPin, Navigation, Phone, X } from '../../../../components/consumer/icons';
import { formatPrice } from '../../../../components/consumer/format';
import { trpc } from '../../../../lib/trpc';

type Storefront = RouterOutputs['vendors']['storefront'];
type VideoItem = Storefront['videos'][number];

/**
 * Premium, fully-responsive vendor storefront. Surfaces everything we collect
 * about a business — logo, hero, editorial "Gloē's take" + perks, hours,
 * amenities, providers, active deals, the vendor's own video reel, and reviews.
 * Built with real CSS classes (see globals.css `.spa-*`) so it reads like a
 * brand on both phone and desktop, not a stretched app screen.
 */
export function SpaStorefrontClient({ id }: { id: string }) {
  const router = useRouter();
  const store = trpc.vendors.storefront.useQuery({ id }, { enabled: !!id });
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  if (store.isLoading) return <Loading />;
  if (store.error || !store.data) return <NotFound />;

  const { vendor, providers, activeDeals, videos, gloeReviews, googleReviews } = store.data;
  const fullAddress = [vendor.addressLine1, vendor.addressLine2, vendor.city, vendor.region, vendor.postalCode]
    .filter(Boolean)
    .join(', ');
  const directionsHref =
    vendor.lat != null && vendor.lng != null
      ? `https://maps.apple.com/?daddr=${vendor.lat},${vendor.lng}`
      : `https://maps.apple.com/?q=${encodeURIComponent(fullAddress)}`;

  // Sticky section jump-nav (mobile only). Only includes sections present on
  // this profile, and only renders at all when there are ≥2 to jump between.
  const navItems = [
    vendor.description ? { id: 'about', label: 'About' } : null,
    providers.length > 0 ? { id: 'providers', label: 'Providers' } : null,
    { id: 'deals', label: 'Deals' },
    gloeReviews.length > 0 || googleReviews.length > 0 ? { id: 'reviews', label: 'Reviews' } : null,
  ].filter((x): x is { id: string; label: string } => x !== null);

  return (
    <div className="spa">
      {/* ── Hero ── */}
      <header className="spa-hero">
        {vendor.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="spa-hero-img" src={vendor.heroImageUrl} alt={vendor.businessName} />
        ) : (
          <div className="spa-hero-img spa-hero-fallback" aria-hidden />
        )}
        <div className="spa-hero-scrim" aria-hidden />

        <button type="button" onClick={() => router.back()} aria-label="Back" className="spa-round-btn spa-hero-back">
          ←
        </button>
        <div className="spa-hero-save">
          <SaveVendorButton vendorId={vendor.id} />
        </div>

        <div className="spa-hero-overlay">
          {vendor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="spa-logo" src={vendor.logoUrl} alt={`${vendor.businessName} logo`} />
          ) : null}
          <div className="spa-hero-titles">
            <h1 className="spa-title">{vendor.businessName}</h1>
            <div className="spa-meta">
              {vendor.ratingAvg != null && vendor.reviewCount > 0 ? (
                <span className="spa-meta-item">
                  <Stars value={Number(vendor.ratingAvg)} size={15} /> {Number(vendor.ratingAvg).toFixed(1)} ({vendor.reviewCount}) on Gloē
                </span>
              ) : null}
              {vendor.googleRating != null && (vendor.googleReviewCount ?? 0) > 0 ? (
                <span className="spa-meta-item">
                  <Stars value={Number(vendor.googleRating)} size={15} /> {Number(vendor.googleRating).toFixed(1)} ({vendor.googleReviewCount}) on Google
                </span>
              ) : null}
              {vendor.city ? (
                <span className="spa-meta-item">
                  <MapPin size={15} color="currentColor" /> {vendor.city}, {vendor.region}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="spa-body">
        <SpaSectionNav items={navItems} />
        <div className="spa-layout">
          {/* Info panel — sticky sidebar on desktop, full-width card up top on mobile. */}
          <aside className="spa-aside">
            <div className="spa-panel">
              <div className="spa-actions">
                <ActionButton href={directionsHref} icon={<Navigation size={16} color="var(--brand-600)" />}>Directions</ActionButton>
                {vendor.phone ? <ActionButton href={`tel:${vendor.phone}`} icon={<Phone size={16} color="var(--brand-600)" />}>Call</ActionButton> : null}
                {vendor.website ? <ActionButton href={vendor.website} icon={<Globe size={16} color="var(--brand-600)" />}>Website</ActionButton> : null}
                {vendor.instagramHandle ? (
                  <ActionButton href={`https://instagram.com/${vendor.instagramHandle.replace(/^@/, '')}`} icon={<Instagram size={16} color="var(--brand-600)" />}>
                    Instagram
                  </ActionButton>
                ) : null}
              </div>

              {vendor.hoursSummary ? (
                <div className="spa-panel-block">
                  <div className="spa-info-head"><Clock size={16} color="var(--brand-600)" /> Hours</div>
                  <p className="spa-info-body">{vendor.hoursSummary}</p>
                </div>
              ) : null}

              {fullAddress ? (
                <div className="spa-panel-block">
                  <div className="spa-info-head"><MapPin size={16} color="var(--brand-600)" /> Location</div>
                  <p className="spa-info-body">{fullAddress}</p>
                  <a className="spa-info-link" href={directionsHref} target="_blank" rel="noreferrer">Get directions →</a>
                </div>
              ) : null}

              {vendor.amenities.length > 0 ? (
                <div className="spa-panel-block">
                  <div className="spa-info-head">Good to know</div>
                  <div className="spa-chips">
                    {vendor.amenities.map((a) => (
                      <span key={a} className="spa-chip">{a}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          {/* Main content column */}
          <main className="spa-main">
            {vendor.gloeTake ? (
              <div className="spa-take">
                <span className="spa-take-label">Gloē&rsquo;s take</span>
                <p className="spa-take-body">{vendor.gloeTake}</p>
                {vendor.gloePerks.length > 0 ? (
                  <div className="spa-chips">
                    {vendor.gloePerks.map((p) => (
                      <span key={p} className="spa-chip spa-chip--brand">{p}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {vendor.description ? (
              <Section id="about" title="About">
                <p className="spa-prose">{vendor.description}</p>
              </Section>
            ) : null}

            {videos.length > 0 ? (
              <Section title="Inside the spa">
                <Carousel ariaLabel={`${vendor.businessName} videos`}>
                  {videos.map((v) => (
                    <button key={v.id} type="button" className="spa-video" onClick={() => setActiveVideo(v)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumbnailUrl} alt={v.caption ?? ''} />
                      <span className="spa-video-play" aria-hidden>▶</span>
                      {v.durationSeconds ? <span className="spa-video-dur">{formatDuration(v.durationSeconds)}</span> : null}
                      {v.caption ? <span className="spa-video-cap">{v.caption}</span> : null}
                    </button>
                  ))}
                </Carousel>
              </Section>
            ) : null}

            {providers.length > 0 ? (
              <Section id="providers" title="Your providers">
                <Carousel ariaLabel="Providers">
                  {providers.map((p) => (
                    <div key={p.id} className="spa-provider">
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photoUrl} alt={p.name} />
                      ) : (
                        <div className="spa-provider-ph" aria-hidden />
                      )}
                      <div className="spa-provider-name">{p.name}</div>
                      <div className="spa-provider-title">{p.title}</div>
                    </div>
                  ))}
                </Carousel>
              </Section>
            ) : null}

            <Section id="deals" title="Active deals">
              {activeDeals.length > 0 ? (
                <div className="deal-grid">
                  {activeDeals.map((deal) => (
                    <ActiveDealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              ) : (
                <p className="spa-empty">No active deals right now — check back soon.</p>
              )}
            </Section>

            {/* Render both review sources; the platform with more reviews leads. */}
            <div id="reviews" className="spa-anchor">
            {(() => {
              const gloeNode = gloeReviews.length > 0 ? (
                <Section key="gloe" title="Reviews on Gloē">
                  <div className="spa-reviews">
                    {gloeReviews.map((r) => (
                      <ReviewCard key={r.id} name={r.authorFirstName ?? 'Guest'} rating={r.rating} text={r.body} />
                    ))}
                  </div>
                </Section>
              ) : null;
              const googleNode = googleReviews.length > 0 ? (
                <Section key="google" title="Reviews on Google">
                  <div className="spa-reviews">
                    {googleReviews.map((r, i) => (
                      <ReviewCard key={i} name={r.authorName} rating={r.rating} text={r.text} when={r.relativeTime} photoUrl={r.profilePhotoUrl} />
                    ))}
                  </div>
                </Section>
              ) : null;
              const gloeCount = vendor.reviewCount || gloeReviews.length;
              const googleCount = (vendor.googleReviewCount ?? 0) || googleReviews.length;
              return [
                { count: gloeCount, node: gloeNode },
                { count: googleCount, node: googleNode },
              ]
                .filter((x) => x.node !== null)
                .sort((a, b) => b.count - a.count)
                .map((x) => x.node);
            })()}
            </div>
          </main>
        </div>
      </div>

      {activeVideo ? <VideoLightbox video={activeVideo} onClose={() => setActiveVideo(null)} /> : null}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Tap-to-play modal for a vendor video. Closes on backdrop click, X, or Esc. */
function VideoLightbox({ video, onClose }: { video: VideoItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="spa-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="spa-lightbox-close" aria-label="Close" onClick={onClose}>
        <X size={22} color="#fff" />
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        className="spa-lightbox-video"
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        controls
        autoPlay
        playsInline
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function ReviewCard({
  name,
  rating,
  text,
  when,
  photoUrl,
}: {
  name: string;
  rating: number;
  text: string | null;
  when?: string;
  photoUrl?: string | null;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || 'G';
  return (
    <div className="spa-review">
      <div className="spa-review-head">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="spa-review-avatar" src={photoUrl} alt="" />
        ) : (
          <span className="spa-review-avatar spa-review-avatar--ph">{initial}</span>
        )}
        <div>
          <div className="spa-review-name">{name}</div>
          <div className="spa-review-sub">
            <Stars value={rating} size={13} />
            {when ? <span className="spa-review-when">· {when}</span> : null}
          </div>
        </div>
      </div>
      {text ? <p className="spa-review-text">{text}</p> : null}
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
      className="spa-save-btn"
      onClick={() => {
        if (!isSignedIn) return router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        toggle.mutate({ vendorId });
      }}
    >
      <Heart size={19} color={saved ? 'var(--accent-500)' : 'var(--text-primary)'} fill={saved ? 'var(--accent-500)' : 'none'} strokeWidth={2.25} />
      <span className="spa-save-label">{saved ? 'Saved' : 'Save'}</span>
    </button>
  );
}

function ActionButton({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="spa-action">
      {icon} {children}
    </a>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="spa-section" id={id}>
      <h2 className="spa-section-title">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Sticky section nav (mobile only) — ResortPass-style underlined text tabs.
 * Clicking scroll-jumps to the section; a scroll-spy (IntersectionObserver)
 * moves the active underline as you scroll. Unlike real tabs it never hides
 * content — deals/reviews stay in the single scroll.
 */
function SpaSectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Activate a section once its top passes ~120px below the sticky header,
      // and keep it active until the next one reaches that band.
      { rootMargin: '-120px 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  const jump = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="spa-subnav" aria-label="Profile sections">
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className={`spa-subnav-tab${active === it.id ? ' is-active' : ''}`}
          onClick={(e) => jump(e, it.id)}
        >
          {it.label}
        </a>
      ))}
    </nav>
  );
}

function Loading() {
  return (
    <div className="spa">
      <div className="spa-hero spa-hero--loading" />
      <div className="spa-body">
        <div className="spa-skel" style={{ height: 34, width: '52%' }} />
        <div className="spa-skel" style={{ height: 16, width: '36%', marginTop: 14 }} />
        <div className="spa-skel" style={{ height: 120, width: '100%', marginTop: 24, borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="spa-body" style={{ paddingTop: 80, textAlign: 'center' }}>
      <h1 style={{ fontSize: 28 }}>Spa not found</h1>
      <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--brand-600)', fontWeight: 600 }}>
        ← Back to deals
      </Link>
    </div>
  );
}
