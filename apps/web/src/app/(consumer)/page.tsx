'use client';

import type { DealSummary } from '@gloe/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { BlurImage } from '../../components/consumer/BlurImage';
import { Carousel } from '../../components/consumer/Carousel';
import { DealCard } from '../../components/consumer/DealCard';
import { GetTheApp } from '../../components/consumer/GetTheApp';
import { useMediaQuery } from '../../components/consumer/useMediaQuery';
import { LocationBanner } from '../../components/consumer/LocationBanner';
import { LocationSheet } from '../../components/consumer/LocationSheet';
import { ArrowRight, ChevronDown, Lock, MapPin, Search, ShieldCheck, Star, Wallet, Zap } from '../../components/consumer/icons';
import { useCyclingPlaceholder } from '../../components/consumer/useCyclingPlaceholder';
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
  const [locOpen, setLocOpen] = useState(false);
  // Cycle the hint through treatments (Try "Botox"… → "Hydrafacial"… → "GLP-1"…),
  // matching the native search bar. Freeze it once the user starts typing.
  const heroPlaceholder = useCyclingPlaceholder((w) => `Try “${w}”…`, { paused: q.length > 0 });
  // Rail cards on phones: wide enough that the meta footer (★ · drive · miles)
  // holds one line, with a sliver of next-card peek. Defaults to 260 on
  // SSR/desktop.
  const railCardW = useMediaQuery('(max-width: 760px)') ? 232 : 260;

  const categories = trpc.categories.list.useQuery();
  const feed = trpc.deals.list.useQuery({ ...locArgs, limit: 100 });
  // Editorial sections (GLO-27): admin-authored taglines that pool 1..N
  // categories into one rail. When present they REPLACE the per-category rails;
  // when absent the home falls back to one rail per category (never blank).
  const sections = trpc.deals.discoverSections.useQuery();

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

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  }

  // Browse tiles + the per-category fallback rails: categories that have deals.
  const populated = (categories.data ?? []).filter((c) => (byCat.get(c.slug)?.length ?? 0) > 0);

  // The editorial rails to render. Each section pools its categories' deals
  // (deduped by deal id, since a deal can carry two of the section's categories)
  // in the feed's existing relevance order. A section with no deals nearby is
  // dropped. Falls back to one rail per populated category when no section is
  // authored — identical to the prior behavior.
  const editorialRails = useMemo(() => {
    const built = (sections.data ?? []).map((s) => {
      const seen = new Set<string>();
      const deals: DealSummary[] = [];
      for (const d of feed.data?.deals ?? []) {
        if (s.categorySlugs.includes(d.category.slug) && !seen.has(d.id)) {
          seen.add(d.id);
          deals.push(d);
        }
      }
      return { id: s.id, tagline: s.tagline, categorySlugs: s.categorySlugs, deals };
    }).filter((r) => r.deals.length > 0);
    if (built.length > 0) return built;
    // Fallback: one rail per populated category, tagline = the category name.
    return populated.map((c) => ({
      id: c.slug,
      tagline: c.displayName,
      categorySlugs: [c.slug],
      deals: byCat.get(c.slug) ?? [],
    }));
  }, [sections.data, feed.data, populated, byCat]);

  return (
    <div>
      {/* Hero — full-bleed image with centered text + search over it
          (ResortPass-style). Drop a purchased photo at /public/hero.jpg; until
          then a warm brand gradient shows through as a graceful fallback. */}
      <section className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-scrim" aria-hidden />
        <div className="hero-content">
          <h1>
            Your best glow
            <br />
            starts <em>here.</em>
          </h1>
          <p className="hero-sub">
            Book vetted med-spas for Botox, fillers, facials and lasers — pay in
            seconds and your voucher lands in your wallet.
          </p>

          <form className="hero-search" onSubmit={submitSearch}>
            <button
              type="button"
              className="hero-search-loc"
              onClick={() => setLocOpen(true)}
              aria-label="Change location"
            >
              <MapPin size={16} color="var(--brand-500)" />
              <span>{location?.label ?? 'Set location'}</span>
            </button>
            <span className="hero-search-sep" aria-hidden />
            <Search size={20} color="var(--text-tertiary)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={heroPlaceholder.placeholder}
              className={heroPlaceholder.fading ? 'placeholder-fading' : undefined}
              aria-label="Search treatments"
            />
            <button type="submit" className="hero-search-btn">
              Search
            </button>
          </form>

          <div className="hero-qchips">
            <span>Popular:</span>
            {POPULAR_SEARCHES.map((w) => (
              <Link key={w} href={`/search?q=${encodeURIComponent(w)}`} className="qchip">
                {w}
              </Link>
            ))}
          </div>
        </div>
        <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
      </section>

      {/* Trust strip — straddles the hero's bottom edge: top half over the
          photo, bottom half on the page background (approved comp move).
          Inventory-independent, so it fills the page even with thin data. */}
      <div className="consumer-container trust-strip-wrap">
        <div className="trust-strip">
          <TrustItem icon={<ShieldCheck size={22} color="var(--brand-600)" />} title="Vetted med-spas" body="Every provider licensed & reviewed" />
          <TrustItem icon={<Wallet size={22} color="var(--brand-600)" />} title="Booking protection" body="Support if the offer isn’t as described" />
          <TrustItem icon={<Zap size={22} color="var(--brand-600)" />} title="Instant voucher" body="Voucher saved to your wallet the second you pay" />
          <TrustItem icon={<Lock size={22} color="var(--brand-600)" />} title="Protected checkout" body="Secure payments through Stripe" />
        </div>
      </div>

      {/* Warm nudge when we don't have a location yet */}
      {!location ? (
        <div className="consumer-container" style={{ paddingTop: 8 }}>
          <LocationBanner />
        </div>
      ) : null}

      {/* Browse by treatment + the editorial rails. Gated together on load and
          backed by a same-shape skeleton so the middle reserves its height —
          the page paints top-to-bottom without the bottom sections jumping.
          Also wait on `sections` so we don't flash per-category rails before the
          editorial taglines resolve. */}
      {feed.isLoading || sections.isLoading ? (
        <HomeFeedSkeleton cardW={railCardW} />
      ) : (
        <>
          {populated.length > 0 ? (
            <div className="consumer-container" style={{ paddingTop: 4 }}>
              <div className="section-head">
                <h2>Browse by treatment</h2>
              </div>
              <Carousel ariaLabel="Browse by treatment">
                {populated.map((c) => {
                  const deals = byCat.get(c.slug) ?? [];
                  // Prefer a curated static tile image; fall back to a real deal photo.
                  const img = TREATMENT_TILE_IMAGES[c.slug] ?? deals.find((d) => d.primaryPhotoUrl)?.primaryPhotoUrl ?? null;
                  return (
                    <Link key={c.slug} href={`/treatments/${c.slug}`} className="cat-card cat-card--carousel">
                      {img ? <BlurImage src={img} alt={c.displayName} /> : null}
                      <span className="cat-card-label">
                        <span className="name">{c.displayName}</span>
                        <span className="count">{deals.length} deal{deals.length > 1 ? 's' : ''} nearby</span>
                      </span>
                    </Link>
                  );
                })}
              </Carousel>
            </div>
          ) : null}

          {editorialRails.map((rail) => {
            // A single-category rail still links to its SEO treatment page +
            // shows a "View more" card. A multi-category editorial section has no
            // single destination on web, so its heading isn't a link and the
            // View-more card is omitted (the rail shows its pooled deals). The
            // tagline is the heading either way — the category noun never shows.
            const singleSlug = rail.categorySlugs.length === 1 ? rail.categorySlugs[0]! : null;
            return (
              <div key={rail.id} style={{ marginTop: 8 }}>
                <div className="consumer-container" style={{ paddingTop: 12, paddingBottom: 0 }}>
                  <div className="section-head" style={{ marginBottom: 12 }}>
                    {singleSlug ? (
                      <Link href={`/treatments/${singleSlug}`} style={{ color: 'inherit' }}>
                        <h2 style={{ margin: 0 }}>{rail.tagline}</h2>
                      </Link>
                    ) : (
                      <h2 style={{ margin: 0 }}>{rail.tagline}</h2>
                    )}
                  </div>
                  <Carousel ariaLabel={rail.tagline}>
                    {rail.deals.slice(0, 12).map((deal) => (
                      <DealCard key={deal.id} deal={deal} width={railCardW} />
                    ))}
                    {singleSlug ? (
                      <ViewMoreCard slug={singleSlug} label={rail.tagline} count={rail.deals.length} />
                    ) : null}
                  </Carousel>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* How it works */}
      <section className="value-band">
        <div className="value-grid">
          <ValueCard step="Discover" icon={<MapPin size={24} color="var(--brand-600)" />} title="Find it nearby" body="Browse deals at premium, vetted spas around you — by treatment, distance, and price." />
          <ValueCard step="Claim" icon={<Wallet size={24} color="var(--brand-600)" />} title="Pay in seconds" body="Secure checkout with Apple Pay or card. Your QR voucher lands in your wallet instantly." />
          <ValueCard step="Glow" icon={<Star size={24} color="var(--brand-600)" />} title="Show & enjoy" body="Book with the spa, show your QR at check-in, and enjoy — payment’s already handled." />
        </div>
      </section>

      {/* Get the app */}
      <GetTheApp />

      {/* FAQ — anchors the bottom, answers the refund/voucher questions, SEO. */}
      <section className="faq-band">
        <div className="consumer-container" style={{ paddingTop: 0 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ fontSize: 32 }}>Questions, answered</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 10, fontSize: 17 }}>
              Everything you need to know before you book.
            </p>
          </div>
          <div className="faq-list">
            {FAQS.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>
                  <span>{f.q}</span>
                  <ChevronDown size={20} color="var(--text-tertiary)" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Curated "Browse by treatment" tile images, keyed by category slug. When a
 * category has one, it overrides the auto-picked deal photo (more consistent,
 * on-brand). Add more as art is sourced — drop the file in /public/treatments.
 */
/** Quick-search chips under the hero search — the marketplace's greatest hits. */
const POPULAR_SEARCHES = ['Botox', 'Hydrafacial', 'Lip filler', 'NAD+ IV', 'Microneedling'];

const TREATMENT_TILE_IMAGES: Record<string, string> = {
  injectables: '/treatments/injectables.jpg',
  'hormones-peptides': '/treatments/peptides.jpg',
};

/**
 * Same-shape placeholder for the deal feed (Browse row + a few rails) shown
 * while data loads. Reserves the middle's height so the page paints
 * top-to-bottom and the marketing sections below never jump on load.
 */
function HomeFeedSkeleton({ cardW }: { cardW: number }) {
  return (
    <div aria-hidden>
      <div className="consumer-container" style={{ paddingTop: 4 }}>
        <div className="section-head"><h2>Browse by treatment</h2></div>
        <div className="skel-rail">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel-tile" />
          ))}
        </div>
      </div>
      {[0, 1, 2].map((r) => (
        <div key={r} style={{ marginTop: 8 }}>
          <div className="consumer-container" style={{ paddingTop: 12, paddingBottom: 0 }}>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <span className="skel-h2" />
            </div>
            <div className="skel-rail">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skel-card" style={{ width: cardW }} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="trust-item">
      <span className="trust-icon">{icon}</span>
      <div>
        <div className="trust-title">{title}</div>
        <div className="trust-body">{body}</div>
      </div>
    </div>
  );
}

/** Homepage FAQ — also the source for FAQPage structured data if we add it. */
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is my purchase refundable?',
    a: 'Yes. If a treatment isn’t as described or you can’t use it, contact us and we’ll make it right — including a full refund. Vouchers are valid through their expiration date.',
  },
  {
    q: 'How do I get and use my voucher?',
    a: 'The moment you pay, a QR voucher lands in your Gloē wallet (and your email). Book with the spa, then show the QR at check-in — your payment is already handled.',
  },
  {
    q: 'Do I need a membership or subscription?',
    a: 'No. Gloē is pay-as-you-go. You only pay for the treatments you book — no membership fees, no recurring charges, no catch.',
  },
  {
    q: 'Are the spas and providers vetted?',
    a: 'Every business is licensed and reviewed before it can list on Gloē, and real customer ratings are shown on each deal so you can book with confidence.',
  },
  {
    q: 'Is checkout secure?',
    a: 'Payments run through Stripe with full encryption. Gloē never stores your card details, and Apple Pay is supported for one-tap checkout.',
  },
];

function ValueCard({ step, icon, title, body }: { step: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="value-card">
      <div className="value-icon">{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-600)' }}>{step}</div>
      <h3 style={{ fontSize: 21, marginTop: 4 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, maxWidth: 320, marginInline: 'auto' }}>{body}</p>
    </div>
  );
}
