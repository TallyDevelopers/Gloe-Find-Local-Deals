'use client';

import { AMENITY_META } from './amenities';
import type { VariantDraft } from './VariantsEditor';

export interface DealPreviewData {
  categoryLabel: string;
  subtypeLabel: string | null;
  title: string;
  description: string;
  whatsIncluded: string[];
  restrictions: string[];
  photoUrls: string[];
  variants: VariantDraft[];
  vendorName: string;
  amenities: string[];
}

/**
 * Pixel-faithful HTML replica of the consumer app's deal-detail screen, inside
 * an iPhone frame. Uses the same design tokens as the RN app so it looks
 * identical. Updates live as the vendor fills the form.
 */
export function DealPreview({ data }: { data: DealPreviewData }) {
  const firstVariant = data.variants.find((v) => v.originalPrice && v.dealPrice) ?? data.variants[0];
  const orig = firstVariant ? Number(firstVariant.originalPrice) : 0;
  const deal = firstVariant ? Number(firstVariant.dealPrice) : 0;
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
          {/* hero */}
          <div
            style={{
              width: '100%',
              aspectRatio: '4 / 3',
              background: data.photoUrls[0]
                ? `center/cover url(${data.photoUrls[0]})`
                : 'linear-gradient(135deg, #e9c8ac, #c68b5f)',
              position: 'relative',
            }}
          >
            {pctOff != null ? (
              <span style={pillStyle}>{pctOff}% off</span>
            ) : null}
          </div>

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

            {/* variant chips */}
            {data.variants.filter((v) => v.label).length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.variants.filter((v) => v.label).map((v, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: `1.5px solid ${i === 0 ? 'var(--brand-500)' : 'var(--border-default)'}`,
                      background: i === 0 ? 'var(--brand-50)' : 'var(--surface-elevated)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{v.label}</div>
                    {v.dealPrice ? (
                      <div style={{ fontSize: 12, color: 'var(--brand-600)', fontWeight: 600 }}>${v.dealPrice}</div>
                    ) : null}
                  </div>
                ))}
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
