'use client';

import type { DealDetail } from '@gloe/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PurchasePanel } from '../../../../components/consumer/PurchasePanel';
import { SaveButton } from '../../../../components/consumer/SaveButton';
import { Stars } from '../../../../components/consumer/Stars';
import { Check, ChevronRight, MapPin } from '../../../../components/consumer/icons';
import { formatProximity, formatReviewCount, milesBetween } from '../../../../components/consumer/format';
import { useLocation } from '../../../../lib/location';
import { trpc } from '../../../../lib/trpc';

export function DealDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { location } = useLocation();
  const deal = trpc.deals.byId.useQuery({ id }, { enabled: !!id });

  const [photoIdx, setPhotoIdx] = useState(0);
  const [variantId, setVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);

  // Default the selected variant once data arrives.
  useEffect(() => {
    if (deal.data && !variantId) {
      setVariantId(deal.data.headlineVariant?.id ?? deal.data.variants[0]?.id ?? '');
    }
  }, [deal.data, variantId]);

  if (deal.isLoading) return <DealSkeleton />;
  if (deal.error || !deal.data) return <NotFound />;

  const d = deal.data;
  const vid = variantId || d.variants[0]?.id || '';

  // Proximity is computed client-side: the detail endpoint doesn't carry the
  // viewer's distance, but we have the vendor's coords + the user's location.
  const proximityMiles =
    location && d.vendor.lat != null && d.vendor.lng != null
      ? milesBetween(location.lat, location.lng, d.vendor.lat, d.vendor.lng)
      : d.distanceMiles;
  const proximity = formatProximity(proximityMiles, d.driveSeconds);
  const reviewLabel = formatReviewCount(d.vendor);
  const rating = d.vendor.combinedRating;
  const scrollToReviews = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="consumer-container" style={{ paddingTop: 16 }}>
      <button type="button" className="see-all" onClick={() => router.back()} style={{ marginBottom: 14 }}>
        ← Back
      </button>
      <div className="deal-layout">
        {/* Main column */}
        <div>
          <Gallery deal={d} index={photoIdx} setIndex={setPhotoIdx} />

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--brand-600)' }}>
              {d.category.subtypeDisplayName ?? d.category.displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <h1 style={{ fontSize: 34, lineHeight: 1.12, marginTop: 6 }}>{d.title}</h1>
              <span style={{ marginTop: 6, flexShrink: 0 }}>
                <SaveButton dealId={d.id} variant="bare" />
              </span>
            </div>

            <div className="deal-meta">
              {rating != null && d.vendor.combinedReviewCount > 0 ? (
                <span className="deal-meta-rating">
                  <Stars value={rating} /> <strong>{rating.toFixed(1)}</strong>
                </span>
              ) : null}
              {reviewLabel ? (
                <>
                  <span className="deal-meta-sep" aria-hidden>·</span>
                  <a href="#reviews" className="deal-meta-link" onClick={scrollToReviews}>{reviewLabel}</a>
                </>
              ) : null}
              {proximity ? (
                <>
                  <span className="deal-meta-sep" aria-hidden>·</span>
                  <span className="deal-meta-prox"><MapPin size={13} /> {proximity}</span>
                </>
              ) : null}
            </div>

            {/* Compact, tappable link to the spa storefront */}
            <Link href={`/spa/${d.vendor.id}`} className="biz-row">
              <span className="biz-row-avatar">{d.vendor.businessName.charAt(0)}</span>
              <span className="biz-row-name">{d.vendor.businessName}</span>
              <span className="biz-row-cta">View profile</span>
              <ChevronRight size={16} color="var(--text-tertiary)" />
            </Link>
          </div>

          {/* Mobile inline purchase panel */}
          <div className="deal-panel-inline">
            <PurchasePanel deal={d} variantId={vid} setVariantId={setVariantId} qty={qty} setQty={setQty} />
          </div>

          {(d.gloeTake || d.gloePerks.length > 0) ? <GloeTake take={d.gloeTake} perks={d.gloePerks} /> : null}

          {/* Long-form sections */}
          {d.description ? (
            <section className="deal-section">
              <h3>About this treatment</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{d.description}</p>
            </section>
          ) : null}

          {d.whatsIncluded.length > 0 ? (
            <section className="deal-section">
              <h3>What&apos;s included</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {d.whatsIncluded.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, marginTop: 2 }}>
                      <Check size={17} color="var(--success)" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {d.providers.length > 0 ? (
            <section className="deal-section">
              <h3>Your provider{d.providers.length > 1 ? 's' : ''}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {d.providers.map((p) => (
                  <div key={p.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-100)', flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{p.title}</div>
                      {p.bio ? <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{p.bio}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <WhereSection deal={d} />

          <ReviewsSection vendorId={d.vendor.id} googlePlaceId={d.vendor.googlePlaceId} />

          {d.restrictions.length > 0 || d.finePrint ? (
            <section className="deal-section">
              <h3>The fine print</h3>
              {d.restrictions.length > 0 ? (
                <ul style={{ listStyle: 'disc', paddingLeft: 20, color: 'var(--text-tertiary)', fontSize: 13.5, lineHeight: 1.7 }}>
                  {d.restrictions.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : null}
              {d.finePrint ? <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>{d.finePrint}</p> : null}
            </section>
          ) : null}
        </div>

        {/* Desktop sticky purchase panel */}
        <aside className="deal-aside">
          <div className="deal-aside-sticky">
            <PurchasePanel deal={d} variantId={vid} setVariantId={setVariantId} qty={qty} setQty={setQty} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Gallery({ deal, index, setIndex }: { deal: DealDetail; index: number; setIndex: (i: number) => void }) {
  const photos = deal.photos.length ? deal.photos : deal.primaryPhotoUrl ? [{ id: 'p', url: deal.primaryPhotoUrl }] : [];
  const current = photos[index] ?? photos[0];
  return (
    <div>
      <div className="deal-gallery-main">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={deal.title} />
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="deal-thumbs hide-scrollbar" style={{ overflowX: 'auto' }}>
          {photos.map((p, i) => (
            <button key={p.id} type="button" className="deal-thumb" data-active={i === index} onClick={() => setIndex(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WhereSection({ deal }: { deal: DealDetail }) {
  const lat = deal.redemption.latitude ?? deal.vendor.lat;
  const lng = deal.redemption.longitude ?? deal.vendor.lng;
  const address = deal.redemption.address ?? deal.vendor.address;
  const mapQuery = trpc.maps.staticMapUrl.useQuery(
    { lat: lat ?? 0, lng: lng ?? 0, zoom: 14, width: 640, height: 280, scale: 2 },
    { enabled: lat != null && lng != null && !deal.redemption.mapUrl },
  );
  const mapUrl = deal.redemption.mapUrl ?? mapQuery.data?.url ?? null;
  const directionsHref = lat != null && lng != null ? `https://maps.apple.com/?daddr=${lat},${lng}` : address ? `https://maps.apple.com/?q=${encodeURIComponent(address)}` : null;

  if (!address && !mapUrl) return null;
  return (
    <section className="deal-section">
      <h3>Where you&apos;ll go</h3>
      {mapUrl ? (
        <a href={directionsHref ?? '#'} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapUrl} alt="Map" style={{ width: '100%', display: 'block' }} />
        </a>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-secondary)' }}>
        <MapPin size={16} color="var(--brand-600)" />
        <span>{address ?? `${deal.vendor.businessName}, ${deal.vendor.city}`}</span>
      </div>
    </section>
  );
}

/** Editorial "Gloē's take" callout — our voice on the spa + quick perk chips. */
function GloeTake({ take, perks }: { take: string | null; perks: string[] }) {
  return (
    <section className="deal-section">
      <div style={{ background: 'var(--brand-50)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-600)', marginBottom: take ? 8 : (perks.length ? 10 : 0) }}>
          Gloē&rsquo;s take
        </div>
        {take ? (
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: 15.5, whiteSpace: 'pre-wrap' }}>{take}</p>
        ) : null}
        {perks.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: take ? 14 : 0 }}>
            {perks.map((p) => (
              <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 999, padding: '6px 12px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                <Check size={14} color="var(--success)" /> {p}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Reviews with a Gloē / Google toggle (parity with the mobile app). Gloē
 * verified-booking reviews show by default; the Google tab lazy-loads live
 * Google reviews (with profile photos + required attribution) only when tapped.
 */
function ReviewsSection({ vendorId, googlePlaceId }: { vendorId: string; googlePlaceId: string | null }) {
  const [tab, setTab] = useState<'gloe' | 'google'>('gloe');
  const [autoPicked, setAutoPicked] = useState(false);
  const [showAllGloe, setShowAllGloe] = useState(false);
  const hasGoogle = !!googlePlaceId;
  const gloe = trpc.reviews.listForVendor.useQuery({ vendorId, limit: 5 }, { enabled: !!vendorId });
  const google = trpc.maps.googleReviews.useQuery(
    { placeId: googlePlaceId ?? '' },
    { enabled: tab === 'google' && hasGoogle, staleTime: 10 * 60_000 },
  );
  const gloeReviews = gloe.data ?? [];

  // Once Gloē reviews load, default to the Google tab when there are fewer than
  // 5 of ours (and Google is available) — lead with whichever has substance.
  useEffect(() => {
    if (autoPicked || !gloe.data) return;
    if (hasGoogle && gloe.data.length < 5) setTab('google');
    setAutoPicked(true);
  }, [gloe.data, hasGoogle, autoPicked]);

  return (
    <section className="deal-section" id="reviews">
      <h3>Reviews</h3>
      {hasGoogle ? (
        <div className="rev-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'gloe'} className={`rev-tab${tab === 'gloe' ? ' is-active' : ''}`} onClick={() => setTab('gloe')}>Gloē</button>
          <button type="button" role="tab" aria-selected={tab === 'google'} className={`rev-tab${tab === 'google' ? ' is-active' : ''}`} onClick={() => setTab('google')}>Google</button>
        </div>
      ) : null}

      {tab === 'gloe' ? (
        gloeReviews.length === 0 ? (
          <p className="spa-empty">No reviews yet — be the first after your appointment.</p>
        ) : (
          <div className="rev-list">
            {(showAllGloe ? gloeReviews : gloeReviews.slice(0, 1)).map((r) => (
              <div key={r.id} className="rev-item">
                <div className="rev-head">
                  <span className="rev-avatar rev-avatar--ph">{(r.authorFirstName ?? 'G').charAt(0)}</span>
                  <div>
                    <div className="rev-name">{r.authorFirstName ?? 'Guest'}</div>
                    <Stars value={r.rating} size={13} />
                  </div>
                </div>
                {r.body ? <p className="rev-text">{r.body}</p> : null}
                {r.photoUrls.length > 0 ? (
                  <div className="rev-photos">
                    {r.photoUrls.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} className="rev-photo" src={u} alt="" loading="lazy" />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {gloeReviews.length > 1 ? (
              <button type="button" className="rev-more" onClick={() => setShowAllGloe((v) => !v)}>
                {showAllGloe ? 'Show less' : `Show ${gloeReviews.length - 1} more review${gloeReviews.length - 1 === 1 ? '' : 's'}`}
              </button>
            ) : null}
          </div>
        )
      ) : google.isLoading ? (
        <p className="spa-empty">Loading Google reviews…</p>
      ) : !google.data || !google.data.available || google.data.reviews.length === 0 ? (
        <p className="spa-empty">No Google reviews available.</p>
      ) : (
        <div className="rev-list">
          {google.data.rating != null ? (
            <div className="rev-google-summary">
              {google.data.rating.toFixed(1)} ★ on Google{google.data.totalRatings ? ` · ${google.data.totalRatings} ratings` : ''}
            </div>
          ) : null}
          {google.data.reviews.map((r, i) => (
            <div key={`${r.authorName}-${i}`} className="rev-item">
              <div className="rev-head">
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rev-avatar" src={r.photoUrl} alt="" />
                ) : (
                  <span className="rev-avatar rev-avatar--ph">{r.authorName.charAt(0)}</span>
                )}
                <div>
                  <div className="rev-name">{r.authorName}</div>
                  <div className="rev-sub"><Stars value={r.rating} size={13} /> <span className="rev-when">· {r.relativeTime}</span></div>
                </div>
              </div>
              {r.text ? <p className="rev-text">{r.text}</p> : null}
            </div>
          ))}
          {google.data.attributionUrl ? (
            <a className="rev-google-link" href={google.data.attributionUrl} target="_blank" rel="noreferrer">View more on Google →</a>
          ) : null}
        </div>
      )}
    </section>
  );
}

function DealSkeleton() {
  return (
    <div className="consumer-container" style={{ paddingTop: 20 }}>
      <style>{'@keyframes gloe-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}</style>
      <div className="deal-layout">
        <div>
          <div className="deal-gallery-main" style={{ background: 'var(--surface-secondary)' }} />
          <div style={{ height: 28, width: '60%', marginTop: 20, borderRadius: 8, background: 'var(--surface-secondary)' }} />
          <div style={{ height: 16, width: '40%', marginTop: 12, borderRadius: 8, background: 'var(--surface-secondary)' }} />
        </div>
        <aside className="deal-aside">
          <div style={{ height: 320, borderRadius: 'var(--radius-lg)', background: 'var(--surface-secondary)' }} />
        </aside>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="consumer-container" style={{ paddingTop: 80, textAlign: 'center' }}>
      <h1 style={{ fontSize: 28 }}>Deal not found</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>It may have sold out or expired.</p>
      <Link href="/" style={{ display: 'inline-block', marginTop: 16, color: 'var(--brand-600)', fontWeight: 600 }}>
        ← Back to deals
      </Link>
    </div>
  );
}
