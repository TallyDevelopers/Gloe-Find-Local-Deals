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
        gap: 18,
        flexWrap: 'wrap',
        background: 'radial-gradient(600px 200px at 0% 0%, var(--brand-100), transparent 70%), var(--brand-50)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <MapPin size={24} color="var(--brand-600)" />
      </span>

      <div style={{ flex: 1, minWidth: 240 }}>
        <h3 style={{ fontSize: 19, marginBottom: 4 }}>We’re not sure where you are yet</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.5 }}>
          So you’re seeing some of our favorite deals from spas across Gloē — not necessarily near you.
          Share your location and we’ll surface what’s closest, with distance and drive times.
        </p>
        {status === 'denied' ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 6 }}>
            Location’s off in your browser — you can also set a city from the pin up top.
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
          gap: 8,
          background: 'var(--brand-500)',
          color: 'var(--text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '13px 24px',
          fontSize: 15,
          fontWeight: 700,
          opacity: status === 'locating' ? 0.7 : 1,
        }}
      >
        <Navigation size={17} color="var(--text-inverse)" />
        {status === 'locating' ? 'Locating…' : 'Use my location'}
      </button>
    </div>
  );
}
