'use client';

import { useRef, useState } from 'react';

import { trpc } from '../../../lib/trpc';
import { AMENITY_META } from './amenities';
import type { VariantDraft } from './VariantsEditor';
import type { DealVideoDraft } from './VideoUploader';

export interface DealPreviewData {
  categoryLabel: string;
  subtypeLabel: string | null;
  title: string;
  description: string;
  whatsIncluded: string[];
  restrictions: string[];
  photoUrls: string[];
  videos: DealVideoDraft[];
  variants: VariantDraft[];
  vendorName: string;
  amenities: string[];
  redemption: { address: string | null; lat: number | null; lng: number | null };
}

/**
 * Pixel-faithful HTML replica of the consumer app's deal-detail screen, inside
 * an iPhone frame. Uses the same design tokens as the RN app so it looks
 * identical. Updates live as the vendor fills the form.
 */
export function DealPreview({ data }: { data: DealPreviewData }) {
  const filledVariants = data.variants.filter((v) => v.label);
  const [selectedIdx, setSelectedIdx] = useState(0);
  // Clamp selection if variants shrink as the vendor edits.
  const activeIdx = selectedIdx < filledVariants.length ? selectedIdx : 0;
  const selected = filledVariants[activeIdx];
  const orig = selected ? Number(selected.originalPrice) : 0;
  const deal = selected ? Number(selected.dealPrice) : 0;
  const pctOff = orig > 0 && deal > 0 && deal < orig ? Math.round(((orig - deal) / orig) * 100) : null;

  return (
    <div
      style={{
        width: 320,
        height: 660,
        borderRadius: 44,
        background: '#1a130f',
        padding: 12,
        boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 34,
          overflow: 'hidden',
          background: 'var(--surface-primary)',
          position: 'relative',
        }}
      >
        {/* notch */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 90,
            height: 22,
            background: '#1a130f',
            borderRadius: 999,
            zIndex: 5,
          }}
        />
        {/* scroll area */}
        <div style={{ height: '100%', overflowY: 'auto' }}>
          {/* hero — swipeable carousel (click-drag on desktop, touch on mobile) */}
          <HeroCarousel photoUrls={data.photoUrls} pctOff={pctOff} />

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {data.categoryLabel.toUpperCase()}
                {data.subtypeLabel ? ` · ${data.subtypeLabel}` : ''}
              </div>
              <div style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 24, fontWeight: 500, marginTop: 4, color: 'var(--text-primary)' }}>
                {data.title || 'Your deal title'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                {data.vendorName} · ★ 4.9 · 1.2 mi
              </div>
            </div>

            {/* variant chips — tap to switch the selected option, like the app */}
            {filledVariants.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {filledVariants.map((v, i) => {
                  const on = i === activeIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedIdx(i)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: `1.5px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
                        background: on ? 'var(--brand-50)' : 'var(--surface-elevated)',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v.label}</div>
                      {v.dealPrice ? (
                        <div style={{ fontSize: 12, color: 'var(--brand-600)', fontWeight: 600 }}>${v.dealPrice}</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* price block */}
            <div style={{ background: 'var(--surface-elevated)', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 28, fontWeight: 600 }}>
                  ${deal || '—'}
                </span>
                {orig ? (
                  <span style={{ fontSize: 15, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>${orig}</span>
                ) : null}
              </div>
            </div>

            <Section title="About this treatment">
              <p style={pStyle}>{data.description || 'Your description will appear here.'}</p>
            </Section>

            {data.whatsIncluded.length > 0 ? (
              <Section title="What's included">
                {data.whatsIncluded.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--brand-500)', fontWeight: 700 }}>✓</span>
                    <span style={pStyle}>{item}</span>
                  </div>
                ))}
              </Section>
            ) : null}

            {data.amenities.length > 0 ? (
              <Section title="This spa offers">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.amenities.map((slug) => {
                    const m = AMENITY_META[slug];
                    if (!m) return null;
                    return (
                      <span key={slug} style={{ fontSize: 12, background: 'var(--surface-secondary)', padding: '5px 10px', borderRadius: 999 }}>
                        {m.icon} {m.label}
                      </span>
                    );
                  })}
                </div>
              </Section>
            ) : null}

            {data.redemption.lat != null && data.redemption.lng != null ? (
              <Section title="Where you'll go">
                <LocationBlock redemption={data.redemption} />
              </Section>
            ) : null}

            {data.videos.length > 0 ? (
              <Section title={`Inside ${data.vendorName}`}>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {data.videos.map((v, i) => (
                    <div key={i} style={{ position: 'relative', flexShrink: 0, width: 96, height: 140, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-secondary)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>▶</span>
                      {v.caption ? (
                        <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', fontSize: 10, color: '#fff', background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                          {v.caption}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {data.restrictions.length > 0 ? (
              <Section title="The fine print">
                {data.restrictions.map((r, i) => (
                  <p key={i} style={{ ...pStyle, fontSize: 12, color: 'var(--text-tertiary)' }}>· {r}</p>
                ))}
              </Section>
            ) : null}

            <div style={{ height: 60 }} />
          </div>

          {/* sticky CTA */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--surface-elevated)',
              borderTop: '1px solid var(--border-subtle)',
              padding: 12,
              display: 'flex',
              gap: 8,
            }}
          >
            <div style={{ flex: 1, background: 'var(--brand-500)', color: '#fff', borderRadius: 999, padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
              Get this deal
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Redemption location: a Google Static Map snapshot + the address, plus a
 * "Calculate distance" callout that asks for the customer's location and shows
 * driving distance + ETA. Mirrors what the consumer app's deal screen does.
 */
function LocationBlock({ redemption }: { redemption: { address: string | null; lat: number | null; lng: number | null } }) {
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const lat = redemption.lat ?? 0;
  const lng = redemption.lng ?? 0;

  const mapQuery = trpc.maps.staticMapUrl.useQuery(
    { lat, lng, width: 600, height: 300, zoom: 15 },
    { enabled: redemption.lat != null && redemption.lng != null, staleTime: 600_000 },
  );

  const directions = trpc.maps.directions.useQuery(
    { originLat: origin?.lat ?? 0, originLng: origin?.lng ?? 0, destLat: lat, destLng: lng, mode: 'driving' },
    { enabled: origin != null, staleTime: 300_000 },
  );

  // Add a walking time too when it's a realistic walk (under 1 mile / 1609 m).
  const isWalkable = directions.data?.found ? directions.data.distanceMeters < 1609 : false;
  const walking = trpc.maps.directions.useQuery(
    { originLat: origin?.lat ?? 0, originLng: origin?.lng ?? 0, destLat: lat, destLng: lng, mode: 'walking' },
    { enabled: origin != null && isWalkable, staleTime: 300_000 },
  );

  const calculate = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Location not available on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError('Allow location access to calculate distance.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const result = directions.data?.found ? directions.data : null;
  const walkText = isWalkable && walking.data?.found ? walking.data.durationText : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {mapQuery.data?.url ? (
        <div style={{ borderRadius: 12, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapQuery.data.url} alt="Map" style={{ width: '100%', display: 'block' }} />
        </div>
      ) : null}

      {redemption.address ? <p style={pStyle}>{redemption.address}</p> : null}

      {result ? (
        <div style={{ background: 'var(--surface-elevated)', borderRadius: 12, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{result.distanceText} away</span>
          <span style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
            ~{result.durationText} drive{walkText ? ` · ${walkText} walk` : ''}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={calculate}
          disabled={locating || directions.isFetching}
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 999,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--brand-600)',
          }}
        >
          {locating || directions.isFetching ? 'Calculating…' : '📍 Calculate distance'}
        </button>
      )}
      {geoError ? <span style={{ color: 'var(--error)', fontSize: 12 }}>{geoError}</span> : null}
    </div>
  );
}

/**
 * Swipeable hero. Drag with mouse (click-hold-move) or finger; releases snap to
 * the nearest slide. Mirrors the consumer app's swipeable photo gallery.
 */
function HeroCarousel({ photoUrls, pctOff }: { photoUrls: string[]; pctOff: number | null }) {
  const slides = photoUrls.length > 0 ? photoUrls : [null];
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  // Clamp when photos are removed during editing.
  const active = index < slides.length ? index : 0;

  const onDown = (clientX: number) => { startX.current = clientX; setDragX(0); };
  const onMove = (clientX: number) => {
    if (startX.current === null) return;
    setDragX(clientX - startX.current);
  };
  const onUp = (width: number) => {
    if (startX.current === null) return;
    const threshold = width * 0.2;
    if (dragX < -threshold && active < slides.length - 1) setIndex(active + 1);
    else if (dragX > threshold && active > 0) setIndex(active - 1);
    startX.current = null;
    setDragX(0);
  };

  return (
    <div
      style={{ width: '100%', aspectRatio: '4 / 3', position: 'relative', overflow: 'hidden', touchAction: 'pan-y', cursor: slides.length > 1 ? 'grab' : 'default' }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); onDown(e.clientX); }}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerUp={(e) => onUp((e.currentTarget as HTMLElement).clientWidth)}
      onPointerLeave={(e) => onUp((e.currentTarget as HTMLElement).clientWidth)}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          transform: `translateX(calc(${-active * 100}% + ${dragX}px))`,
          transition: startX.current === null ? 'transform 0.25s ease' : 'none',
        }}
      >
        {slides.map((url, i) => (
          <div
            key={i}
            style={{
              flex: '0 0 100%',
              height: '100%',
              background: url ? `center/cover url(${url})` : 'linear-gradient(135deg, #e9c8ac, #c68b5f)',
            }}
          />
        ))}
      </div>

      {pctOff != null ? <span style={pillStyle}>{pctOff}% off</span> : null}

      {slides.length > 1 ? (
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {slides.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === active ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? '#fff' : 'rgba(255,255,255,0.6)',
                transition: 'width 0.2s',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  background: 'var(--brand-500)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
};

const pStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: 17, fontWeight: 500 }}>{title}</div>
      {children}
    </div>
  );
}
