'use client';

import type { DealSummary } from '@gloe/api-client';
import Link from 'next/link';

import { BlurImage } from './BlurImage';
import { SaveButton } from './SaveButton';
import { Clock, MapPin, Star } from './icons';
import { discountPct, formatDistance, formatDriveTime, formatPrice, formatRating } from './format';

/**
 * Image-dominant deal card — the unit of the marketplace. Fills its grid column,
 * or takes a fixed width inside a horizontal rail. Tap → /deals/[id].
 */
export function DealCard({ deal, width }: { deal: DealSummary; width?: number }) {
  const variant = deal.headlineVariant;
  if (!variant) return null;

  const pct = discountPct(variant.originalPriceCents, variant.dealPriceCents);
  const rating = formatRating(deal.vendor);
  const drive = formatDriveTime(deal.driveSeconds);
  const distance = formatDistance(deal.distanceMiles);
  const subtitle = deal.category.subtypeDisplayName ?? deal.category.displayName;

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="deal-card"
      style={{ display: 'block', width: width ? width : undefined, color: 'inherit' }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: 'var(--surface-secondary)' }}>
        {deal.primaryPhotoUrl ? (
          <BlurImage
            src={deal.primaryPhotoUrl}
            alt={deal.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}

        {pct > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'var(--brand-500)',
              color: 'var(--text-inverse)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              padding: '4px 9px',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {pct}% off
          </span>
        ) : null}

        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <SaveButton dealId={deal.id} size="sm" />
        </div>
      </div>

      <div style={{ padding: '12px 14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
          {subtitle}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 500,
            lineHeight: 1.2,
            color: 'var(--text-primary)',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {deal.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 7 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatPrice(variant.dealPriceCents)}
          </span>
          {pct > 0 ? (
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
              {formatPrice(variant.originalPriceCents)}
            </span>
          ) : null}
        </div>

        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {deal.vendor.businessName}
        </div>

        {(rating || drive || distance) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 12.5, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
            {rating ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Star size={12} color="var(--gold)" fill="var(--gold)" strokeWidth={0} />
                {rating}
              </span>
            ) : null}
            {drive ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {rating ? <Dot /> : null}
                <Clock size={11} /> {drive}
              </span>
            ) : null}
            {distance ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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
