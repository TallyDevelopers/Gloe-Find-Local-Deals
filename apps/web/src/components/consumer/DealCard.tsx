'use client';

import type { DealSummary } from '@gloe/api-client';
import Link from 'next/link';

import { BlurImage } from './BlurImage';
import { SaveButton } from './SaveButton';
import { BadgeCheck, Clock, MapPin, Star } from './icons';
import { discountPct, formatDistance, formatDriveTime, formatPrice, formatRating, promoBadgeLabel, promoPriceCents } from './format';

/**
 * Image-dominant deal card — the unit of the marketplace. Fills its grid column,
 * or takes a fixed width inside a horizontal rail. Tap → /deals/[id].
 */
export function DealCard({ deal, width }: { deal: DealSummary; width?: number }) {
  const variant = deal.headlineVariant;
  if (!variant) return null;

  // Deal promo (GLO-44): the badge takes the top-left slot over "% off", and
  // the price row shows the post-promo price so what's on the card is what
  // checkout charges. The struck anchor stays the true original price.
  const promo = deal.promo;
  const effectivePriceCents = promoPriceCents(variant.dealPriceCents, promo);
  const pct = discountPct(variant.originalPriceCents, variant.dealPriceCents);
  const rating = formatRating(deal.vendor);
  const drive = formatDriveTime(deal.driveSeconds);
  const distance = formatDistance(deal.distanceMiles);
  const subtitle = deal.category.subtypeDisplayName ?? deal.category.displayName;
  // "Glow Aesthetics La Jolla · La Jolla" reads silly — only append the city
  // when the business name doesn't already carry it.
  const showCity = deal.vendor.city && !deal.vendor.businessName.toLowerCase().includes(deal.vendor.city.toLowerCase());

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="deal-card"
      style={{ display: 'block', width: width ? width : undefined, color: 'inherit' }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 11', background: 'var(--surface-secondary)' }}>
        {deal.primaryPhotoUrl ? (
          <BlurImage
            src={deal.primaryPhotoUrl}
            alt={deal.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}

        {promo || pct > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: promo ? 'var(--brand-600)' : 'var(--brand-500)',
              color: 'var(--text-inverse)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              padding: '4px 9px',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {promo ? promoBadgeLabel(promo) : `${pct}% off`}
          </span>
        ) : null}

        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <SaveButton dealId={deal.id} size="sm" />
        </div>

        {deal.isTrending ? (
          <span
            style={{
              position: 'absolute',
              bottom: 12,
              left: 0,
              background: '#B05A6B',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              // Small ribbon tab flush to the image's left edge.
              borderRadius: '0 4px 4px 0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            }}
          >
            Trending
          </span>
        ) : null}
      </div>

      {/* Body — the comp's anatomy, top to bottom: rose-gold category eyebrow,
          2-line title, verified provider row, price row, then a hairline-topped
          meta footer (rating · drive · distance). */}
      <div style={{ padding: '13px 15px 15px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand-600)' }}>
          {subtitle}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.28,
            color: 'var(--text-primary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            // Two lines reserved so price rows align across a rail.
            minHeight: '2.56em',
          }}
        >
          {deal.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', minWidth: 0 }}>
          <BadgeCheck size={14} color="var(--brand-500)" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {deal.vendor.businessName}
            {showCity ? ` · ${deal.vendor.city}` : null}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            {formatPrice(effectivePriceCents)}
          </span>
          {promo || pct > 0 ? (
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
              {formatPrice(variant.originalPriceCents)}
            </span>
          ) : null}
        </div>

        {(rating || drive || distance) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              paddingTop: 9,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {rating ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Star size={12} color="var(--gold)" fill="var(--gold)" strokeWidth={0} />
                {rating}
              </span>
            ) : null}
            {drive ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {rating ? <Dot /> : null}
                <Clock size={11} /> {drive}
              </span>
            ) : null}
            {distance ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {rating || drive ? <Dot /> : null}
                <MapPin size={11} /> {distance}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  );
}

function Dot() {
  return <span style={{ opacity: 0.5 }}>·</span>;
}
