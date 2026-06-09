'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, Field, TextInput } from '../../../components/ui';
import { trpc } from '../../../lib/trpc';
import { AdminChrome } from '../console/AdminChrome';

const CATEGORIES = [
  { slug: 'injectables', label: 'Injectables' },
  { slug: 'skin', label: 'Skin' },
  { slug: 'laser', label: 'Laser' },
  { slug: 'body', label: 'Body' },
  { slug: 'wellness', label: 'Wellness' },
  { slug: 'other', label: 'Other' },
];

interface Resolved {
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

/**
 * Founder tool: create a spa's account on their behalf (no signup from them).
 * Address autocompletes via Google Places, which also gives us the place_id
 * (Google reviews) and coords (map). On create we jump straight to posting
 * their first deal.
 */
export default function AddSpaPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const autocomplete = trpc.geocode.autocomplete.useQuery(
    { query },
    { enabled: query.length >= 3 && !resolved, staleTime: 30_000 },
  );

  const create = trpc.admin.createVendorOnBehalf.useMutation({
    onSuccess: (v) => {
      void utils.admin.vendorRoster.invalidate();
      // Land on the spa's page — post a deal later from there if you want.
      router.push(`/admin/vendor/${v.id}`);
    },
    onError: (e) => setError(e.message),
  });

  const selectPlace = async (placeId: string, description: string) => {
    setQuery(description);
    try {
      const d = await utils.geocode.placeDetails.fetch({ placeId });
      setResolved({
        addressLine1: d.addressLine1 || description,
        city: d.city,
        region: d.region,
        postalCode: d.postalCode,
        latitude: d.latitude,
        longitude: d.longitude,
        placeId: d.placeId ?? placeId,
      });
    } catch {
      setError('Could not load that address. Pick another.');
    }
  };

  const toggle = (slug: string) =>
    setCategories((prev) => {
      const n = new Set(prev);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  const canSubmit = businessName.length >= 2 && phone.length >= 7 && resolved !== null;

  const submit = () => {
    if (!resolved) return;
    setError(null);
    create.mutate({
      businessName,
      phone,
      addressLine1: resolved.addressLine1,
      city: resolved.city,
      region: resolved.region,
      postalCode: resolved.postalCode,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      googlePlaceId: resolved.placeId,
      categorySlugs: [...categories],
      ownerEmail: ownerEmail.trim() || null,
    });
  };

  return (
    <AdminChrome active="vendors">
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontSize: 32 }}>Add a spa</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginTop: 4 }}>
            Set them up on the spot. They connect Stripe later — after their first sale.
          </p>
        </div>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Field label="Business name">
              <TextInput value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Pacific Beach Aesthetics" />
            </Field>

            <Field label="Business phone">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(619) 555-0100" inputMode="tel" />
            </Field>

            <Field label="Owner email (optional)" hint="Lets you send the claim invite later — when they sign in with this email, the business links to them automatically.">
              <TextInput value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@theirspa.com" inputMode="email" />
            </Field>

            <Field label="Business address" hint={resolved ? undefined : 'Start typing — pick from the list'}>
              <div style={{ position: 'relative' }}>
                <TextInput
                  style={{ width: '100%' }}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setResolved(null); }}
                  placeholder="Start typing the address…"
                />
                {query.length >= 3 && !resolved && autocomplete.data && autocomplete.data.length > 0 ? (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginTop: 4, overflow: 'hidden', background: 'var(--surface-elevated)', boxShadow: '0 8px 24px rgba(43,32,25,0.12)' }}>
                    {autocomplete.data.map((p) => (
                      <button key={p.placeId} type="button" onClick={() => selectPlace(p.placeId, p.description)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'var(--surface-elevated)', border: 'none', borderBottom: '1px solid var(--border-subtle)', fontSize: 15, color: 'var(--text-primary)' }}>
                        {p.description}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>

            {resolved ? (
              <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
                <span>{resolved.addressLine1}, {resolved.city}, {resolved.region} {resolved.postalCode}</span>
              </div>
            ) : null}

            <Field label="What do they offer?" hint="Pick all that apply">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {CATEGORIES.map((c) => {
                  const onSel = categories.has(c.slug);
                  return (
                    <button key={c.slug} type="button" onClick={() => toggle(c.slug)} style={{ padding: '8px 16px', borderRadius: 999, border: `1px solid ${onSel ? 'var(--brand-500)' : 'var(--border-default)'}`, background: onSel ? 'var(--brand-500)' : 'var(--surface-elevated)', color: onSel ? 'var(--text-inverse)' : 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {error ? <p style={{ color: 'var(--error)', fontSize: 14 }}>{error}</p> : null}

            <Button onClick={submit} disabled={!canSubmit || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create spa'}
            </Button>
          </div>
        </Card>
      </div>
    </AdminChrome>
  );
}
