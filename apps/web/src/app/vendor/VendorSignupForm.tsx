'use client';

import { useState } from 'react';

import { BrandPanel } from '../../components/BrandPanel';
import { Button, Card, Field, TextInput } from '../../components/ui';
import { trpc } from '../../lib/trpc';

const CATEGORIES = [
  { slug: 'injectables', label: 'Injectables' },
  { slug: 'skin', label: 'Skin' },
  { slug: 'laser', label: 'Laser' },
  { slug: 'body', label: 'Body' },
  { slug: 'wellness', label: 'Wellness' },
  { slug: 'other', label: 'Other' },
];

interface ResolvedAddress {
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

export function VendorSignupForm({ onCreated }: { onCreated: () => void }) {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [resolved, setResolved] = useState<ResolvedAddress | null>(null);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Live autocomplete as they type (Google Places)
  const autocomplete = trpc.geocode.autocomplete.useQuery(
    { query: addressQuery },
    { enabled: addressQuery.length >= 3 && !resolved, staleTime: 30_000 },
  );

  const signup = trpc.vendor.signup.useMutation({
    onSuccess: () => onCreated(),
    onError: (e) => setError(e.message),
  });

  const selectPlace = async (placeId: string, description: string) => {
    setResolvingPlaceId(placeId);
    setAddressQuery(description);
    try {
      const details = await utils.geocode.placeDetails.fetch({ placeId });
      setResolved({
        addressLine1: details.addressLine1 || description,
        city: details.city,
        region: details.region,
        postalCode: details.postalCode,
        latitude: details.latitude,
        longitude: details.longitude,
      });
    } catch {
      setError('Could not load that address. Pick another.');
    } finally {
      setResolvingPlaceId(null);
    }
  };

  const toggleCategory = (slug: string) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const canSubmit = businessName.length >= 2 && phone.length >= 7 && resolved !== null;

  const handleSubmit = () => {
    if (!resolved) return;
    setError(null);
    signup.mutate({
      businessName,
      phone,
      addressLine1: resolved.addressLine1,
      city: resolved.city,
      region: resolved.region,
      postalCode: resolved.postalCode,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      categorySlugs: [...categories],
    });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left brand panel — hidden on narrow screens via the wrapper below */}
      <div className="brand-panel-wrap" style={{ display: 'flex', flex: '1 1 0', minWidth: 0 }}>
        <BrandPanel />
      </div>

      {/* Right form column */}
      <main
        style={{
          flex: '1 1 0',
          minWidth: 0,
          maxWidth: 620,
          margin: '0 auto',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        <h1 style={{ fontSize: 40 }}>Set up your business</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 17 }}>
          Takes about a minute. You can add your license, photos, and bank details later — before
          your first deal goes live.
        </p>
      </div>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Field label="Business name">
            <TextInput
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Glow Aesthetics La Jolla"
            />
          </Field>

          <Field label="Business phone">
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(619) 555-0100"
              inputMode="tel"
            />
          </Field>

          <Field
            label="Business address"
            hint={resolved ? undefined : 'Start typing — pick your address from the list'}
          >
            <div style={{ position: 'relative' }}>
              <TextInput
                style={{ width: '100%' }}
                value={addressQuery}
                onChange={(e) => {
                  setAddressQuery(e.target.value);
                  setResolved(null);
                }}
                placeholder="Start typing your address…"
              />
              {addressQuery.length >= 3 && !resolved && autocomplete.data && autocomplete.data.length > 0 ? (
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
                      onClick={() => selectPlace(p.placeId, p.description)}
                      disabled={resolvingPlaceId !== null}
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

          {resolved ? (
            <div
              style={{
                background: 'var(--surface-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: 14,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
              <span>
                {resolved.addressLine1}, {resolved.city}, {resolved.region} {resolved.postalCode}
              </span>
            </div>
          ) : null}

          <Field label="What do you offer?" hint="Pick all that apply">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {CATEGORIES.map((c) => {
                const on = categories.has(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => toggleCategory(c.slug)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-pill)',
                      border: `1px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
                      background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
                      color: on ? 'var(--text-inverse)' : 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {error ? <p style={{ color: 'var(--error)', fontSize: 14 }}>{error}</p> : null}

          <Button onClick={handleSubmit} disabled={!canSubmit || signup.isPending}>
            {signup.isPending ? 'Creating…' : 'Create my business account'}
          </Button>
        </div>
      </Card>
      </main>
    </div>
  );
}
