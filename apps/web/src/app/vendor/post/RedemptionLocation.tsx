'use client';

import { useState } from 'react';

import { Field, TextInput } from '../../../components/ui';
import { trpc } from '../../../lib/trpc';

export interface RedemptionValue {
  /** null address + coords => redeem at the business address. */
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface RedemptionLocationProps {
  value: RedemptionValue;
  onChange: (v: RedemptionValue) => void;
  businessAddress: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

/**
 * Lets the vendor pick where the deal is redeemed: their business address (the
 * default, from signup) or a different address via Google Places. Shows a
 * static-map snapshot of the chosen spot.
 */
export function RedemptionLocation({ value, onChange, businessAddress }: RedemptionLocationProps) {
  // Track the chosen mode separately from whether coords are resolved yet —
  // clicking "different address" enters custom mode before any pick is made.
  const initialCustom = value.lat != null || (value.address ?? '') !== '';
  const [mode, setMode] = useState<'business' | 'custom'>(initialCustom ? 'custom' : 'business');
  const usesCustom = mode === 'custom';
  const resolved = value.lat != null && value.lng != null;
  const [query, setQuery] = useState(value.address ?? '');
  const [resolving, setResolving] = useState(false);
  const utils = trpc.useUtils();

  const autocomplete = trpc.geocode.autocomplete.useQuery(
    { query },
    { enabled: usesCustom && !resolved && query.length >= 3, staleTime: 30_000 },
  );

  const businessSummary = businessAddress
    ? [businessAddress.line1, businessAddress.city, businessAddress.region, businessAddress.postalCode]
        .filter(Boolean)
        .join(', ')
    : 'Your business address';

  // Coords for the preview map: resolved custom pick, else business address.
  const mapLat = usesCustom && resolved ? value.lat : businessAddress?.latitude ?? null;
  const mapLng = usesCustom && resolved ? value.lng : businessAddress?.longitude ?? null;
  const mapQuery = trpc.maps.staticMapUrl.useQuery(
    { lat: mapLat ?? 0, lng: mapLng ?? 0, width: 560, height: 240, zoom: 15 },
    { enabled: mapLat != null && mapLng != null, staleTime: 600_000 },
  );

  const chooseBusiness = () => {
    setMode('business');
    setQuery('');
    onChange({ address: null, lat: null, lng: null });
  };
  const chooseCustom = () => {
    // Switch to custom mode; coords stay empty until they pick an address.
    setMode('custom');
    onChange({ address: '', lat: null, lng: null });
  };

  const selectPlace = async (placeId: string, description: string) => {
    setResolving(true);
    setQuery(description);
    try {
      const d = await utils.geocode.placeDetails.fetch({ placeId });
      onChange({
        address: d.formattedAddress || description,
        lat: d.latitude,
        lng: d.longitude,
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ChoiceChip on={!usesCustom} onClick={chooseBusiness} label="My business address" />
        <ChoiceChip on={usesCustom} onClick={chooseCustom} label="A different address" />
      </div>

      {!usesCustom ? (
        <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 14, color: 'var(--text-secondary)' }}>
          Redeemed at {businessSummary}
        </div>
      ) : (
        <Field label="Redemption address" hint={resolved ? undefined : 'Start typing — pick from the list'}>
          <div style={{ position: 'relative' }}>
            <TextInput
              style={{ width: '100%' }}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (resolved) onChange({ address: '', lat: null, lng: null });
              }}
              placeholder="Where do customers go to redeem?"
            />
            {usesCustom && !resolved && query.length >= 3 && autocomplete.data && autocomplete.data.length > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: 4,
                  overflow: 'hidden',
                  background: 'var(--surface-elevated)',
                  boxShadow: '0 8px 24px rgba(43,32,25,0.12)',
                }}
              >
                {autocomplete.data.map((p) => (
                  <button
                    key={p.placeId}
                    type="button"
                    disabled={resolving}
                    onClick={() => selectPlace(p.placeId, p.description)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      background: 'var(--surface-elevated)',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 15,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Field>
      )}

      {mapQuery.data?.url ? (
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapQuery.data.url} alt="Map of redemption location" style={{ width: '100%', display: 'block' }} />
        </div>
      ) : (
        <div style={{ height: 120, borderRadius: 'var(--radius-md)', background: 'var(--surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
          {usesCustom ? 'Pick an address to see the map' : 'No business location on file yet'}
        </div>
      )}
    </div>
  );
}

function ChoiceChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
        background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
        color: on ? 'var(--text-inverse)' : 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}
