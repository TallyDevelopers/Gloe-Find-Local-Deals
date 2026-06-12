'use client';

import { useClerk, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { BrandPanel } from '../../components/BrandPanel';
import { Wordmark } from '../../components/Wordmark';
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
  placeId: string;
}

export function VendorSignupForm({
  onCreated,
  footnote,
}: {
  onCreated: () => void;
  /** Quiet line under the CTA — e.g. the "expecting to see your spa?" claim retry. */
  footnote?: ReactNode;
}) {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [resolved, setResolved] = useState<ResolvedAddress | null>(null);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The page is auth-gated with no site chrome, and claiming depends on WHICH
  // account you're in — so the escape hatches live here: back home + sign out.
  const { user } = useUser();
  const { signOut } = useClerk();
  const signedInEmail = user?.primaryEmailAddress?.emailAddress;

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
        placeId: details.placeId ?? placeId,
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

  const canSubmit = businessName.length >= 2 && phone.length >= 7 && resolved !== null && agreedToTerms;

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
      googlePlaceId: resolved.placeId,
      categorySlugs: [...categories],
      agreeToTerms: agreedToTerms,
    });
  };

  return (
    <div className="biz-layout">
      {/* Left brand panel — hidden on narrow screens */}
      <div className="brand-panel-wrap" style={{ display: 'flex', flex: '1 1 0', minWidth: 0 }}>
        <BrandPanel />
      </div>

      {/* Right form column */}
      <main className="biz-form-col">
        <div className="biz-utility-row">
          <Link href="/" className="biz-utility-link">← Back to Gloē</Link>
          <span className="biz-utility-id">
            {signedInEmail ? <span className="biz-utility-email">{signedInEmail}</span> : null}
            <button
              type="button"
              className="biz-utility-link"
              onClick={() => void signOut({ redirectUrl: '/vendor' })}
            >
              Sign out
            </button>
          </span>
        </div>
        <div className="biz-form-inner">
          {/* Brand header for narrow screens, where the left panel is hidden */}
          <div className="biz-mobile-brand">
            <Wordmark size={26} tone="gold" />
            <span
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
              }}
            >
              FOR BUSINESS
            </span>
          </div>
          <h1>Set up your business</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.55, marginTop: 10 }}>
            Takes about a minute. License, photos, and bank details come later —
            before your first deal goes live.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 36 }}>
            <div>
              <label className="biz-label" htmlFor="biz-name">Business name</label>
              <input
                id="biz-name"
                className="biz-input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Glow Aesthetics La Jolla"
              />
            </div>

            <div>
              <label className="biz-label" htmlFor="biz-phone">Business phone</label>
              <input
                id="biz-phone"
                className="biz-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(619) 555-0100"
                inputMode="tel"
              />
            </div>

            <div>
              <label className="biz-label" htmlFor="biz-address">Business address</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="biz-address"
                  className="biz-input"
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    setResolved(null);
                  }}
                  placeholder="Start typing — pick from the list"
                  autoComplete="off"
                />
                {addressQuery.length >= 3 && !resolved && autocomplete.data && autocomplete.data.length > 0 ? (
                  <div className="biz-suggestions">
                    {autocomplete.data.map((p) => (
                      <button
                        key={p.placeId}
                        type="button"
                        className="biz-suggestion"
                        onClick={() => selectPlace(p.placeId, p.description)}
                        disabled={resolvingPlaceId !== null}
                      >
                        {p.description}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {resolved ? (
                <div className="biz-resolved">
                  <span className="biz-resolved-check">✓</span>
                  <span>
                    {resolved.addressLine1}, {resolved.city}, {resolved.region} {resolved.postalCode}
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <span className="biz-label">What do you offer?</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    className="biz-chip"
                    data-on={categories.has(c.slug)}
                    onClick={() => toggleCategory(c.slug)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10 }}>
                Pick all that apply — you can change these later.
              </p>
            </div>

            {/* GLO-35: Vendor Agreement acceptance — required, stamped on the vendor row. */}
            <label
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--brand-600)', flexShrink: 0 }}
              />
              <span>
                I agree to the{' '}
                <Link href="/legal/vendor-terms" target="_blank" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
                  Gloē Vendor Agreement
                </Link>
                , including its chargeback-liability terms.
              </span>
            </label>

            {error ? <p style={{ color: 'var(--error)', fontSize: 14 }}>{error}</p> : null}

            <div>
              <button
                type="button"
                className="biz-cta"
                onClick={handleSubmit}
                disabled={!canSubmit || signup.isPending}
              >
                {signup.isPending ? 'Creating…' : 'Create my business account'}
              </button>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 14 }}>
                Free to join. Gloē only earns a fee when a deal sells.
              </p>
            </div>

            {footnote}
          </div>
        </div>
      </main>
    </div>
  );
}
