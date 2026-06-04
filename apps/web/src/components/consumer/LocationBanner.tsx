'use client';

import { MapPin, Navigation } from './icons';
import { useLocation } from '../../lib/location';

/**
 * Warm "we don't know where you are yet" banner. Shown only when the shopper
 * hasn't shared a location — it explains that the feed is showing favorites from
 * across Gloē (not necessarily nearby) and offers a one-tap "Use my location".
 * Disappears the moment a location is set (the feed then re-ranks by distance).
 */
export function LocationBanner() {
  const { location, status, useMyLocation } = useLocation();
  if (location) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        background: 'var(--brand-50)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MapPin size={17} color="var(--brand-600)" />
      </span>

      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.4 }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Set your location</strong> for deals closest to you — with distance &amp; drive times.
        </p>
        {status === 'denied' ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 3 }}>
            Location’s off in your browser — set a city from the pin up top.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={status === 'locating'}
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--brand-500)',
          color: 'var(--text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '9px 16px',
          fontSize: 13.5,
          fontWeight: 700,
          opacity: status === 'locating' ? 0.7 : 1,
        }}
      >
        <Navigation size={15} color="var(--text-inverse)" />
        {status === 'locating' ? 'Locating…' : 'Use my location'}
      </button>
    </div>
  );
}
