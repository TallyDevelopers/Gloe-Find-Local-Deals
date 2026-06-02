'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

import { DealCard } from '../../../components/consumer/DealCard';
import { SignInGate } from '../../../components/consumer/SignInGate';
import { Stars } from '../../../components/consumer/Stars';
import { MapPin } from '../../../components/consumer/icons';
import { trpc } from '../../../lib/trpc';

/**
 * Saved deals + saved spas. Mirrors the app's "Saved" tab. The deals tab reuses
 * deals.list and filters to saved ids (no batch-by-id endpoint); the spas tab
 * uses saved.listVendors directly.
 */
export default function SavedPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [tab, setTab] = useState<'deals' | 'spas'>('deals');

  if (isLoaded && !isSignedIn) {
    return <SignInGate title="Your saved deals live here" subtitle="Sign in to save deals and spas and pick up where you left off." />;
  }

  return (
    <div className="consumer-container" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>Saved</h1>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 8 }}>
        <Segmented active={tab === 'deals'} onClick={() => setTab('deals')}>Deals</Segmented>
        <Segmented active={tab === 'spas'} onClick={() => setTab('spas')}>Spas</Segmented>
      </div>

      {tab === 'deals' ? <SavedDeals /> : <SavedSpas />}
    </div>
  );
}

function SavedDeals() {
  const ids = trpc.saved.listIds.useQuery();
  const all = trpc.deals.list.useQuery({ limit: 100 });
  const savedSet = new Set(ids.data ?? []);
  const deals = (all.data?.deals ?? []).filter((d) => savedSet.has(d.id));

  if (ids.isLoading || all.isLoading) return <p style={{ color: 'var(--text-tertiary)', paddingTop: 16 }}>Loading…</p>;
  if (deals.length === 0) return <Empty message="No saved deals yet. Tap the heart on any deal to save it." />;

  return (
    <div className="deal-grid" style={{ marginTop: 16 }}>
      {deals.map((d) => (
        <DealCard key={d.id} deal={d} />
      ))}
    </div>
  );
}

function SavedSpas() {
  const vendors = trpc.saved.listVendors.useQuery();
  if (vendors.isLoading) return <p style={{ color: 'var(--text-tertiary)', paddingTop: 16 }}>Loading…</p>;
  if (!vendors.data || vendors.data.length === 0) return <Empty message="No saved spas yet. Save a spa from its page to keep it close." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      {vendors.data.map((v) => (
        <Link
          key={v.vendorId}
          href={`/spa/${v.vendorId}`}
          className="deal-card"
          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, color: 'inherit' }}
        >
          {v.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.heroImageUrl} alt={v.businessName} style={{ width: 84, height: 84, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: 'var(--radius-md)', background: 'var(--brand-100)', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{v.businessName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: 'var(--text-tertiary)', fontSize: 13.5 }}>
              <MapPin size={13} /> {v.city}, {v.region}
              {v.ratingAvg != null && v.reviewCount > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  · <Stars value={v.ratingAvg} size={12} /> {v.ratingAvg.toFixed(1)}
                </span>
              ) : null}
            </div>
            {v.activeDealCount > 0 ? (
              <div style={{ fontSize: 13, color: 'var(--brand-600)', fontWeight: 600, marginTop: 4 }}>
                {v.activeDealCount} active deal{v.activeDealCount > 1 ? 's' : ''}
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Segmented({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 14.5,
        fontWeight: 600,
        padding: '9px 18px',
        borderRadius: 'var(--radius-pill)',
        border: active ? '1px solid var(--brand-500)' : '1px solid var(--border-subtle)',
        background: active ? 'var(--brand-500)' : 'var(--surface-elevated)',
        color: active ? 'var(--text-inverse)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-secondary)' }}>
      <p>{message}</p>
      <Link href="/" style={{ display: 'inline-block', marginTop: 14, color: 'var(--brand-600)', fontWeight: 600 }}>
        Browse deals →
      </Link>
    </div>
  );
}
