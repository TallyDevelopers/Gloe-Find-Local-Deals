'use client';

import type { DealDetail } from '@gloe/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PurchasePanel } from '../../../../components/consumer/PurchasePanel';
import { SaveButton } from '../../../../components/consumer/SaveButton';
import { Stars } from '../../../../components/consumer/Stars';
import { Check, ChevronRight, MapPin } from '../../../../components/consumer/icons';
import { formatDistance, formatRating } from '../../../../components/consumer/format';
import { trpc } from '../../../../lib/trpc';

export function DealDetailClient({ id }: { id: string }) {
  const router = useRouter();
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              {formatRating(d.vendor) ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 14 }}>
                  <Stars value={d.vendor.combinedRating ?? 0} /> {formatRating(d.vendor)}
                </span>
              ) : null}
              {formatDistance(d.distanceMiles) ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)', fontSize: 14 }}>
                  <MapPin size={13} /> {formatDistance(d.distanceMiles)}
                </span>
              ) : null}
            </div>

            {/* Tappable business profile row — opens the spa storefront */}
            <Link href={`/spa/${d.vendor.id}`} className="biz-row">
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--brand-100)',
                  color: 'var(--brand-600)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: 19,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {d.vendor.businessName.charAt(0)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 15.5, color: 'var(--text-primary)' }}>{d.vendor.businessName}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-tertiary)' }}>{d.vendor.city} · View business profile</span>
              </span>
              <ChevronRight size={18} color="var(--text-tertiary)" />
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

          <ReviewsSection vendorId={d.vendor.id} />

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

function ReviewsSection({ vendorId }: { vendorId: string }) {
  const reviews = trpc.reviews.listForVendor.useQuery({ vendorId, limit: 3 }, { enabled: !!vendorId });
  if (!reviews.data || reviews.data.length === 0) return null;
  return (
    <section className="deal-section">
      <h3>What guests say</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {reviews.data.map((r) => (
          <div key={r.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stars value={r.rating} size={14} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.authorFirstName ?? 'Guest'}</span>
            </div>
            {r.body ? <p style={{ color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>{r.body}</p> : null}
          </div>
        ))}
      </div>
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
