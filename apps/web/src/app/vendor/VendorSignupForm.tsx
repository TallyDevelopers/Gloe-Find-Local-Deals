'use client';

import { useState } from 'react';

import { BrandPanel } from '../../components/BrandPanel';
import { Button, Card, Field, TextInput } from '../../components/ui';
import { trpc } from '../../lib/trpc';

const CATEGORIES = [
  { slug: 'botox', label: 'Botox' },
  { slug: 'filler', label: 'Filler' },
  { slug: 'skin', label: 'Skin' },
  { slug: 'body', label: 'Body' },
  { slug: 'wellness', label: 'Wellness' },
  { slug: 'hair', label: 'Hair' },
];

interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
}

export function VendorSignupForm({ onCreated }: { onCreated: () => void }) {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<GeocodeResult | null>(null);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const geocode = trpc.geocode.forward.useQuery(
    { query: addressQuery },
    { enabled: addressQuery.length > 4, staleTime: 60_000 },
  );

  const signup = trpc.vendor.signup.useMutation({
    onSuccess: () => onCreated(),
    onError: (e) => setError(e.message),
  });

  const toggleCategory = (slug: string) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const canSubmit =
    businessName.length >= 2 &&
    phone.length >= 7 &&
    selectedAddress !== null &&
    city &&
    region &&
    postalCode;

  const handleSubmit = () => {
    if (!selectedAddress) return;
    setError(null);
    signup.mutate({
      businessName,
      phone,
      addressLine1: addressQuery,
      city,
      region,
      postalCode,
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude,
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
            label="Address"
            hint={selectedAddress ? `✓ ${selectedAddress.label}` : 'Start typing, then pick a match'}
          >
            <TextInput
              value={addressQuery}
              onChange={(e) => {
                setAddressQuery(e.target.value);
                setSelectedAddress(null);
              }}
              placeholder="7777 Girard Ave, La Jolla, CA"
            />
            {addressQuery.length > 4 && !selectedAddress && geocode.data && geocode.data.length > 0 ? (
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                {geocode.data.map((r) => (
                  <button
                    key={`${r.latitude},${r.longitude}`}
                    type="button"
                    onClick={() => {
                      setSelectedAddress(r);
                      setAddressQuery(r.label.split(',').slice(0, 2).join(', '));
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      background: 'var(--surface-elevated)',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>

          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="City">
              <TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="La Jolla" />
            </Field>
            <Field label="State">
              <TextInput value={region} onChange={(e) => setRegion(e.target.value)} placeholder="CA" />
            </Field>
            <Field label="ZIP">
              <TextInput value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="92037" />
            </Field>
          </div>

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
