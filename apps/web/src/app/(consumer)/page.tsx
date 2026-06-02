'use client';

import type { DealSummary } from '@gloe/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DealCard } from '../../components/consumer/DealCard';
import { GetTheApp } from '../../components/consumer/GetTheApp';
import { LocationBanner } from '../../components/consumer/LocationBanner';
import { DealGridSkeleton } from '../../components/consumer/Skeletons';
import { ArrowRight, Check, Search, Sparkles, Star } from '../../components/consumer/icons';
import { useDealLocationArgs, useLocation } from '../../lib/location';
import { trpc } from '../../lib/trpc';

/**
 * Consumer home — a destination, not just a feed. Value-forward hero, a
 * photo-rich "browse by treatment" row, a section (rail) per category, how-it-
 * works, and a closing CTA. Treatments are real routes (/treatments/[slug]) so
 * Back works and they're shareable.
 */
export default function HomePage() {
  const router = useRouter();
  const { location } = useLocation();
  const locArgs = useDealLocationArgs();
  const [q, setQ] = useState('');

  const categories = trpc.categories.list.useQuery();
  const feed = trpc.deals.list.useQuery({ ...locArgs, limit: 100 });

  // Group the home feed by category once — powers the hero image, the browse
  // cards (representative photo + count), and every rail. One query, no N+1.
  const byCat = useMemo(() => {
    const m = new Map<string, DealSummary[]>();
    for (const d of feed.data?.deals ?? []) {
      const arr = m.get(d.category.slug);
      if (arr) arr.push(d);
      else m.set(d.category.slug, [d]);
    }
    return m;
  }, [feed.data]);
  const heroDeal = useMemo(() => (feed.data?.deals ?? []).find((d) => d.primaryPhotoUrl) ?? null, [feed.data]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  }

  const populated = (categories.data ?? []).filter((c) => (byCat.get(c.slug)?.length ?? 0) > 0);

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-grid">
            <div>
              <span style={badgeStyle}>
                <Sparkles size={15} color="var(--brand-600)" /> Same-day beauty &amp; wellness
              </span>
              <h1 style={{ marginTop: 18 }}>
                Treat yourself
                <br />
                for less.
              </h1>
              <p style={{ fontSize: 19, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 520, marginTop: 16 }}>
                Gloē is the easiest way to book botox, fillers, facials, and laser at premium
                medspas near you — up to 60% off, with your voucher delivered instantly.
              </p>

              <form className="hero-search" onSubmit={submitSearch}>
                <Search size={20} color="var(--text-tertiary)" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “botox”, “hydrafacial”, “lip filler”…" aria-label="Search treatments" />
                <button type="submit" style={{ background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '11px 22px', fontSize: 15, fontWeight: 700 }}>
                  Search
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, color: 'var(--text-tertiary)', fontSize: 13.5, flexWrap: 'wrap' }}>
                <span style={trustChip}><Check size={14} color="var(--success)" /> No membership</span>
                <span style={trustChip}><Check size={14} color="var(--success)" /> Instant QR voucher</span>
                <span style={trustChip}><Check size={14} color="var(--success)" /> 3-day refund</span>
              </div>
            </div>

            {heroDeal?.primaryPhotoUrl ? (
              <Link href={`/deals/${heroDeal.id}`} className="hero-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroDeal.primaryPhotoUrl} alt={heroDeal.title} />
                <div className="hero-photo-cap">
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>
                    {heroDeal.category.subtypeDisplayName ?? heroDeal.category.displayName}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginTop: 2 }}>{heroDeal.title}</div>
                  <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{heroDeal.vendor.businessName}</div>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Warm nudge when we don't have a location yet */}
      {!location ? (
        <div className="consumer-container" style={{ paddingTop: 8 }}>
          <LocationBanner />
        </div>
      ) : null}

      {/* Browse by treatment — photo cards */}
      {populated.length > 0 ? (
        <div className="consumer-container" style={{ paddingTop: 4 }}>
          <div className="section-head">
            <h2>Browse by treatment</h2>
          </div>
          <div className="cat-card-grid">
            {populated.map((c) => {
              const deals = byCat.get(c.slug) ?? [];
              const img = deals.find((d) => d.primaryPhotoUrl)?.primaryPhotoUrl ?? null;
              return (
                <Link key={c.slug} href={`/treatments/${c.slug}`} className="cat-card">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={c.displayName} loading="lazy" />
                  ) : null}
                  <span className="cat-card-label">
                    <span className="name">{c.displayName}</span>
                    <span className="count">{deals.length} deal{deals.length > 1 ? 's' : ''} nearby</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* A rail per category */}
      {feed.isLoading ? (
        <div className="consumer-container" style={{ paddingTop: 24 }}>
          <DealGridSkeleton count={5} />
        </div>
      ) : (
        populated.map((c) => {
          const deals = byCat.get(c.slug) ?? [];
          return (
            <div key={c.slug} style={{ marginTop: 8 }}>
              <div className="consumer-container" style={{ paddingTop: 12, paddingBottom: 0 }}>
                <div className="section-head" style={{ marginBottom: 12 }}>
                  <Link href={`/treatments/${c.slug}`} style={{ color: 'inherit' }}>
                    <h2 style={{ margin: 0 }}>{c.displayName}</h2>
                  </Link>
                </div>
              </div>
              <div className="rail hide-scrollbar">
                {deals.slice(0, 12).map((deal) => (
                  <DealCard key={deal.id} deal={deal} width={260} />
                ))}
                <ViewMoreCard slug={c.slug} label={c.displayName} count={deals.length} />
              </div>
            </div>
          );
        })
      )}

      {/* How it works */}
      <section className="value-band">
        <div className="value-grid">
          <ValueCard step="Discover" title="Find it nearby" body="Browse same-day deals at premium, vetted spas around you — by treatment, distance, and price." />
          <ValueCard step="Claim" title="Pay in seconds" body="Secure checkout with Apple Pay or card. Your QR voucher lands in your wallet instantly." />
          <ValueCard step="Glow" title="Show & enjoy" body="Book with the spa, show your QR at check-in, and enjoy — payment’s already handled." />
        </div>
      </section>

      {/* Get the app */}
      <GetTheApp />

      {/* Closing CTA */}
      <section className="cta-band">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--gold)', marginBottom: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={18} color="var(--gold)" fill="var(--gold)" strokeWidth={0} />)}
        </div>
        <h2 style={{ fontSize: 32, maxWidth: 560, margin: '0 auto' }}>Your next glow is minutes away</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 17, maxWidth: 480, marginInline: 'auto' }}>
          Join thousands booking beauty &amp; wellness for less — no membership, no catch.
        </p>
        <Link href="/search" style={{ display: 'inline-block', marginTop: 24, background: 'var(--brand-500)', color: 'var(--text-inverse)', padding: '15px 34px', borderRadius: 'var(--radius-pill)', fontSize: 16, fontWeight: 700 }}>
          Find a deal near you
        </Link>
      </section>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--brand-600)',
  background: 'var(--surface-elevated)',
  padding: '7px 14px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border-subtle)',
};
const trustChip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5 };

/** Terminal card at the end of a category rail — the "view all" affordance. */
function ViewMoreCard({ slug, label, count }: { slug: string; label: string; count: number }) {
  return (
    <Link
      href={`/treatments/${slug}`}
      className="view-more-card"
      style={{
        width: 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'var(--brand-50)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--brand-600)',
        textAlign: 'center',
        padding: 22,
      }}
    >
      <span style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowRight size={22} color="var(--brand-600)" />
      </span>
      <span style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25 }}>View all {label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{count}+ nearby</span>
    </Link>
  );
}

function ValueCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="value-card">
      <div className="value-icon">
        <Sparkles size={24} color="var(--brand-600)" />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-600)' }}>{step}</div>
      <h3 style={{ fontSize: 21, marginTop: 4 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, maxWidth: 320, marginInline: 'auto' }}>{body}</p>
    </div>
  );
}
