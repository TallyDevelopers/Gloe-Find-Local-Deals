'use client';

import { useState } from 'react';

import { trpc } from '../../lib/trpc';
import { useLocation } from '../../lib/location';
import { MapPin, Navigation, Search, X } from './icons';

/**
 * The location control in the top nav. Shows the current location label and,
 * when opened, lets the shopper use browser GPS or type a city/address
 * (geocode.autocomplete → placeDetails). Distance + drive-time ranking on the
 * feed depends on this.
 */
export function LocationPill() {
  const { location, status, useMyLocation, setLocation } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const utils = trpc.useUtils();

  const predictions = trpc.geocode.autocomplete.useQuery(
    { query },
    { enabled: query.trim().length >= 3, staleTime: 60_000 },
  );

  async function pick(placeId: string, description: string) {
    try {
      const place = await utils.geocode.placeDetails.fetch({ placeId });
      const label = place.city ? `${place.city}, ${place.region}` : description;
      setLocation({ lat: place.latitude, lng: place.longitude, label });
      setOpen(false);
      setQuery('');
    } catch {
      /* surfaced via the input staying open */
    }
  }

  const label = location?.label ?? 'Set location';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-elevated)',
          color: location ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 14,
          fontWeight: 600,
          maxWidth: 200,
        }}
      >
        <MapPin size={15} color="var(--brand-600)" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </button>

      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 50,
              width: 320,
              maxWidth: '90vw',
              background: 'var(--surface-elevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 12px 40px rgba(43,32,25,0.16)',
              padding: 14,
            }}
          >
            <button
              type="button"
              onClick={useMyLocation}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                width: '100%',
                padding: '11px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--brand-50)',
                color: 'var(--brand-600)',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <Navigation size={16} color="var(--brand-600)" />
              {status === 'locating' ? 'Locating…' : 'Use my current location'}
            </button>
            {status === 'denied' ? (
              <div style={{ fontSize: 12.5, color: 'var(--error)', marginBottom: 10 }}>
                Couldn’t get your location. Search for a city instead.
              </div>
            ) : null}

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}>
                <Search size={15} color="var(--text-tertiary)" />
              </span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="City or address"
                style={{
                  width: '100%',
                  fontSize: 15,
                  padding: '11px 34px 11px 34px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4 }}
                >
                  <X size={15} color="var(--text-tertiary)" />
                </button>
              ) : null}
            </div>

            {predictions.data && predictions.data.length > 0 ? (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>
                {predictions.data.slice(0, 5).map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    onClick={() => pick(p.placeId, p.description)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                    }}
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
