'use client';

import { useEffect, useState } from 'react';

import { trpc } from '../../lib/trpc';
import { useLocation, type GloeLocation } from '../../lib/location';
import { MapPin, Navigation, Search, X } from './icons';

/**
 * The location picker, as a bottom sheet. Separate from search by design.
 * - No location yet → prompt to share it; one tap uses browser GPS.
 * - Change it → pick a popular city or look one up (geocode autocomplete).
 * Shared by the mobile sticky search and (optionally) anywhere else.
 */

const POPULAR_CITIES: GloeLocation[] = [
  { label: 'San Diego, CA', lat: 32.7157, lng: -117.1611 },
  { label: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { label: 'Orange County, CA', lat: 33.7175, lng: -117.8311 },
  { label: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
  { label: 'Las Vegas, NV', lat: 36.1699, lng: -115.1398 },
  { label: 'Phoenix, AZ', lat: 33.4484, lng: -112.074 },
  { label: 'Dallas, TX', lat: 32.7767, lng: -96.797 },
  { label: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
  { label: 'New York, NY', lat: 40.7128, lng: -74.006 },
];

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { location, status, useMyLocation, setLocation } = useLocation();
  const [query, setQuery] = useState('');
  const [awaitingGps, setAwaitingGps] = useState(false);
  const utils = trpc.useUtils();

  const predictions = trpc.geocode.autocomplete.useQuery(
    { query },
    { enabled: open && query.trim().length >= 3, staleTime: 60_000 },
  );

  // Close once a GPS request the user kicked off resolves successfully.
  useEffect(() => {
    if (awaitingGps && status === 'ready') {
      setAwaitingGps(false);
      onClose();
    }
  }, [awaitingGps, status, onClose]);

  // Reset transient state whenever it closes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setAwaitingGps(false);
    }
  }, [open]);

  if (!open) return null;

  const choose = (loc: GloeLocation) => {
    setLocation(loc);
    onClose();
  };

  async function pick(placeId: string, description: string) {
    try {
      const place = await utils.geocode.placeDetails.fetch({ placeId });
      const label = place.city ? `${place.city}, ${place.region}` : description;
      choose({ lat: place.latitude, lng: place.longitude, label });
    } catch {
      /* keep the sheet open so they can retry */
    }
  }

  const searching = query.trim().length >= 3;

  return (
    <div className="loc-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="loc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="loc-sheet-head">
          <h3>Your location</h3>
          <button type="button" className="loc-sheet-x" aria-label="Close" onClick={onClose}>
            <X size={20} color="var(--text-primary)" />
          </button>
        </div>

        <p className="loc-sheet-sub">
          {location ? (
            <>Showing deals near <strong>{location.label}</strong>.</>
          ) : (
            <>Share your location to see deals and drive times near you.</>
          )}
        </p>

        <button
          type="button"
          className="loc-sheet-gps"
          onClick={() => {
            setAwaitingGps(true);
            useMyLocation();
          }}
        >
          <Navigation size={17} color="var(--brand-600)" />
          {status === 'locating' ? 'Locating…' : location ? 'Use my current location' : 'Share my location'}
        </button>
        {status === 'denied' ? (
          <div className="loc-sheet-err">Couldn’t get your location — pick a city below instead.</div>
        ) : null}

        <div className="loc-sheet-search">
          <Search size={15} color="var(--text-tertiary)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city or address"
            aria-label="Search a city or address"
          />
          {query ? (
            <button type="button" aria-label="Clear" onClick={() => setQuery('')}>
              <X size={14} color="var(--text-tertiary)" />
            </button>
          ) : null}
        </div>

        {searching && predictions.data && predictions.data.length > 0 ? (
          <div className="loc-sheet-results">
            {predictions.data.slice(0, 6).map((p) => (
              <button key={p.placeId} type="button" className="loc-sheet-result" onClick={() => pick(p.placeId, p.description)}>
                <MapPin size={14} color="var(--text-tertiary)" />
                <span>{p.description}</span>
              </button>
            ))}
          </div>
        ) : searching ? (
          <div className="loc-sheet-empty">No matches — try a nearby city.</div>
        ) : (
          <>
            <div className="loc-sheet-label">Popular cities</div>
            <div className="loc-sheet-cities">
              {POPULAR_CITIES.map((c) => {
                const active = location?.label === c.label;
                return (
                  <button
                    key={c.label}
                    type="button"
                    className={`loc-sheet-city${active ? ' is-active' : ''}`}
                    onClick={() => choose(c)}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
