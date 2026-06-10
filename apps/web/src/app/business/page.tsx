import { SignedIn, SignedOut } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Check, Lock, MapPin, ShieldCheck, Star, Wallet, Zap } from '../../components/consumer/icons';
import { PhoneMock } from '../../components/consumer/GetTheApp';
import { Wordmark } from '../../components/Wordmark';

export const metadata: Metadata = {
  title: 'For Businesses — fill your chairs with Gloē',
  description:
    'Post your aesthetic deals on Gloē and reach new clients near you. No monthly fees, no upfront cost — you only pay a small fee when a client books.',
};

/**
 * For Businesses — the vendor marketing page. Copy is sourced from the living
 * product docs (HOW-IT-WORKS.md / GLOE.md); the editorial design (Newsreader
 * serif accents, floating trust cards, dark bands) follows the approved
 * Claude-Design comp, recolored to the app's ink-mauve dark theme. Dark hero
 * matches the vendor signup brand panel so landing → auth → setup reads as
 * one continuous flow. Public; CTAs route into the vendor portal.
 */
export default function ForBusinessPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface-primary)' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(19,18,23,0.85)', backdropFilter: 'saturate(140%) blur(14px)', borderBottom: '1px solid rgba(240,237,241,0.1)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" aria-label="Gloē home" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12 }}>
            <Wordmark size={24} tone="gold" />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: '#857f89' }}>FOR BUSINESS</span>
          </Link>
          <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
            <a href="#how" className="bl-nav-link show-desktop-inline">How it works</a>
            <a href="#pricing" className="bl-nav-link show-desktop-inline">Pricing</a>
            <a href="#faq" className="bl-nav-link show-desktop-inline">FAQ</a>
            <SignedOut>
              <Link href="/sign-in?redirect_url=/vendor" className="bl-nav-link">Sign in</Link>
              <Link href="/sign-up?redirect_url=/vendor" style={cta('sm')}>List your spa</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/vendor" style={cta('sm')}>Go to dashboard</Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* Hero — dark ink-mauve, same family as the vendor signup panel */}
      <section className="bl-hero">
        <div className="bl-hero-grid">
          <div className="bl-hero-copy">
            <span style={{ ...eyebrow, color: '#ddab9c' }}>Built for spas &amp; med-spas</span>
            <h1 style={{ marginTop: 16 }}>
              Your quiet hours,
              <br />
              <span className="bl-accent">booked.</span>
            </h1>
            <p className="bl-hero-sub">
              List your treatments and reach clients searching nearby. They pay up front, you scan
              their voucher at check-in, and <strong>the payout releases the moment you redeem.</strong>
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <SignedOut>
                <Link href="/sign-up?redirect_url=/vendor" className="bl-cta-primary">Post your first deal — free →</Link>
                <a href="#how" className="bl-cta-ghost">See how it works</a>
              </SignedOut>
              <SignedIn>
                <Link href="/vendor" className="bl-cta-primary">Go to your dashboard</Link>
              </SignedIn>
            </div>
            <div className="bl-hero-bullets">
              <span>No monthly fees</span>
              <span>·</span>
              <span>No card required</span>
              <span>·</span>
              <span>One small fee, only when a deal sells</span>
            </div>
          </div>
          <div className="bl-hero-phone" aria-hidden>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Trust cards floating across the hero seam */}
      <div className="bl-trust-float">
        <div className="trust-strip">
          <TrustItem icon={<ShieldCheck size={22} color="var(--brand-600)" />} title="License-verified" body="Every spa is checked by a human — clients book with confidence" />
          <TrustItem icon={<Zap size={22} color="var(--brand-600)" />} title="Paid on redemption" body="Your payout releases the moment you scan the voucher" />
          <TrustItem icon={<Lock size={22} color="var(--brand-600)" />} title="Dispute protection" body="A chargeback freezes the voucher instantly — no free treatments" />
          <TrustItem icon={<Star size={22} color="var(--brand-600)" />} title="Human-reviewed" body="Nothing goes live on Gloē without a person approving it" />
        </div>
      </div>

      {/* How it works — numbered editorial journey */}
      <section id="how" className="bl-journey">
        <h2 className="bl-h2">
          From listed to <span className="bl-accent">paid</span>, in one loop.
        </h2>
        <p className="bl-section-sub" style={{ marginBottom: 28 }}>
          Set up in minutes from your browser. No contracts, no card up front, no Stripe paperwork —
          and every dollar you earn shows in one dashboard.
        </p>
        <JourneyRow n="01" title="Post a treatment in under a minute." body="Set your price, options, and spots. Type the title and Gloē tags the treatment for you, so the right clients always find it. Start it as a private draft before you’re even verified." />
        <JourneyRow n="02" title="A human approves it, then clients nearby see it." body="Submit your license once; a person reviews it against the state board before anything reaches clients. Once live, your deal shows up in the app, on the map, and in search — and clients nearby can get pinged the moment it drops." />
        <JourneyRow n="03" title="They’ve already paid. You just scan." body="Open the scanner on any phone or tablet and read the client’s QR at check-in — no extra hardware. The voucher only redeems when you scan it, so a no-show never becomes a refund out of your pocket." />
        <JourneyRow n="04" title="The payout releases the moment you redeem." body="Standard payouts land on a daily schedule via Stripe, free. Need it faster? Instant payout sends cash to a linked debit card in about 30 minutes." />
      </section>

      {/* Why Gloē */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 0' }}>
        <h2 className="bl-h2" style={{ textAlign: 'center', marginInline: 'auto' }}>
          Fill slow days without <span className="bl-accent">cheapening</span> your brand.
        </h2>
        <div className="value-grid" style={{ padding: '32px 0 0' }}>
          <Benefit Icon={ShieldCheck} title="No-show-proof revenue" body="Clients pay when they book, and the voucher only redeems when you scan it at check-in. A no-show never costs you a refund — it just expires." />
          <Benefit Icon={MapPin} title="Reach local clients" body="Clients browsing nearby see your deal in the app, on the map, and in search — and can get pinged the moment it drops." />
          <Benefit Icon={Zap} title="Move off-peak inventory" body="Fill last-minute and quiet hours without slashing your everyday prices or training clients to wait for a discount." />
          <Benefit Icon={Star} title="Win reviews & regulars" body="First visits turn into 5-star reviews and repeat clients — the goal is the second booking, not just the first." />
          <Benefit Icon={Check} title="Stay in control" body="Per-customer and lifetime caps, spot counts, and expirations keep deals on your terms. Pause or edit anytime." />
          <Benefit Icon={Wallet} title="Transparent pricing" body="One per-sale fee, visible up front — and the fee on a sale is locked in when it happens, never changed after the fact." />
        </div>
      </section>

      {/* Pricing — dark band */}
      <section id="pricing" className="bl-band-dark" style={{ marginTop: 72 }}>
        <h2 className="bl-h2">
          No subscription. No setup fee.
          <br />
          <span className="bl-accent">One small fee per sale.</span>
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 560, margin: '16px auto 0' }}>
          Gloē takes a small fee only when a customer buys one of your deals — and you keep the
          rest, paid out through Stripe. The fee is locked in when the sale happens, never changed
          after the fact.
        </p>
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: 32, marginTop: 28 }}>
          <PricePoint big="$0" small="to join" dark />
          <PricePoint big="$0" small="monthly" dark />
          <PricePoint big="Per sale" small="one small fee, only when you’re paid" dark />
        </div>
        <div style={{ marginTop: 32 }}>
          <SignedOut>
            <Link href="/sign-up?redirect_url=/vendor" className="bl-cta-primary">Start free — keep the rest →</Link>
          </SignedOut>
          <SignedIn>
            <Link href="/vendor" className="bl-cta-primary">Go to your dashboard</Link>
          </SignedIn>
        </div>
      </section>

      {/* Curated marketplace — protection */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 0' }}>
        <h2 className="bl-h2" style={{ textAlign: 'center', marginInline: 'auto' }}>
          A curated marketplace — <span className="bl-accent">not</span> a coupon dump.
        </h2>
        <div className="value-grid" style={{ padding: '32px 0 0' }}>
          <Feature title="Verified means verified" body="Your license is checked by a human against the issuing state board, and the document lives in private storage — never on a public URL. Clients see a marketplace they can trust, and you’re part of it." />
          <Feature title="Every listing human-approved" body="Deals are reviewed by a person before they reach customers, and editing a live deal sends it back through review. No bait-and-switch can share a page with you." />
          <Feature title="Chargeback armor" body="The moment a card dispute opens, every unredeemed voucher on that order freezes automatically — nobody disputes a payment and still walks in for the treatment." />
          <Feature title="Clean books" body="Refunds before redemption never touch your payout — you were never paid, so nothing claws back. Money you’ve earned shows in your dashboard down to the dollar." />
        </div>
      </section>

      {/* One portal */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 0' }}>
        <h2 className="bl-h2" style={{ textAlign: 'center', marginInline: 'auto' }}>
          Run the whole thing from <span className="bl-accent">one portal.</span>
        </h2>
        <div className="value-grid" style={{ padding: '32px 0 0' }}>
          <Feature title="Multiple options" body="Offer variants — e.g. 20, 40, or 60 units — each with its own price and spot count." />
          <Feature title="Photos & video" body="Show your space and results with a gallery and short clips that build trust." />
          <Feature title="Your providers" body="Introduce the injector or esthetician with a bio and photo, so clients know who they’ll see." />
          <Feature title="Auto-tagging" body="Type the treatment and the listing tags it for you, so search always finds you. It suggests; you stay in charge." />
          <Feature title="Smart limits" body="Per-customer and lifetime caps, spot counts, and expirations keep deals on your terms." />
          <Feature title="Payouts & reporting" body="Today’s sales, money queued for transfer, and your live Stripe balance — no spreadsheet." />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px 0' }}>
        <h2 className="bl-h2" style={{ textAlign: 'center', marginInline: 'auto' }}>
          The things spas <span className="bl-accent">ask first.</span>
        </h2>
        <div style={{ marginTop: 24 }}>
          <Faq q="How much does it cost?" a="Nothing to join and no monthly fee. Gloē takes one small fee only when a customer buys one of your deals, and that fee is locked in at purchase — never retroactively changed. You keep the rest." />
          <Faq q="When do I get paid?" a="Your payout releases the moment you redeem a voucher. Standard payouts land via Stripe on a daily schedule, free. Need it faster? Instant payout sends cash to a linked debit card in about 30 minutes." />
          <Faq q="What’s the verification process?" a="You submit your license — number, state, type, and a photo or PDF — from your dashboard. It’s stored privately and reviewed by a human against the state board. Approval is the moment your spa goes live, and if something’s off you see the exact reason and can resubmit." />
          <Faq q="What if a customer doesn’t show?" a="They’ve already paid, and the voucher only redeems when you scan it — a no-show never becomes a refund out of your pocket. Unredeemed vouchers simply expire on the date you set." />
          <Faq q="What about chargebacks?" a="The instant a dispute opens, every unredeemed voucher on that order freezes automatically — your scanner will say the voucher is on hold, so nobody disputes a payment and still gets the service." />
          <Faq q="Do I need a special app?" a="No — you manage everything from the Gloē business portal on the web: post deals, scan QR codes to redeem, and track payouts. No extra hardware." />
          <Faq q="Will this cheapen my brand?" a="No — you set the deal and the terms, and every spa on Gloē is license-verified with human-reviewed listings. This is a curated marketplace built to bring you new regulars, not a coupon dump." />
        </div>
      </section>

      {/* Final CTA — dark band */}
      <section className="bl-band-dark" style={{ marginTop: 72 }}>
        <h2 className="bl-h2">
          Ready to fill <span className="bl-accent">your books?</span>
        </h2>
        <p style={{ marginTop: 12, fontSize: 17, maxWidth: 480, marginInline: 'auto' }}>
          Join Gloē free and post your first deal today. New clients are searching nearby right now.
        </p>
        <div style={{ marginTop: 26 }}>
          <SignedOut>
            <Link href="/sign-up?redirect_url=/vendor" className="bl-cta-primary">Post your first deal — free →</Link>
          </SignedOut>
          <SignedIn>
            <Link href="/vendor" className="bl-cta-primary">Go to your dashboard</Link>
          </SignedIn>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '28px 24px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
        <Link href="/" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>← Back to Gloē</Link>
        <span style={{ margin: '0 10px' }}>·</span>
        <Link href="/legal/terms" style={{ color: 'var(--text-tertiary)' }}>Terms</Link>
        <span style={{ margin: '0 10px' }}>·</span>
        <Link href="/legal/privacy" style={{ color: 'var(--text-tertiary)' }}>Privacy</Link>
        <div style={{ marginTop: 10 }}>© 2026 Gloē</div>
      </footer>
    </main>
  );
}

const eyebrow: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--brand-600)',
};

function cta(size: 'sm' | 'lg'): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    borderRadius: 'var(--radius-pill)',
    fontSize: size === 'lg' ? 16 : 14,
    padding: size === 'lg' ? '14px 28px' : '9px 18px',
    background: 'var(--brand-500)',
    color: 'var(--text-inverse)',
    border: 'none',
  };
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="trust-item">
      {icon}
      <div>
        <div className="trust-title">{title}</div>
        <div className="trust-body">{body}</div>
      </div>
    </div>
  );
}

function JourneyRow({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="bl-journey-row">
      <span className="bl-journey-num">{n}</span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}

function Benefit({ Icon, title, body }: { Icon: typeof Wallet; title: string; body: string }) {
  return (
    <div className="value-card" style={{ textAlign: 'left' }}>
      <div className="value-icon" style={{ margin: 0 }}>
        <Icon size={22} color="var(--brand-600)" />
      </div>
      <h3 style={{ fontSize: 18, marginTop: 12 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6 }}>{body}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="value-card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'inline-flex', marginBottom: 8 }}>
        <Check size={18} color="var(--success)" />
      </div>
      <h3 style={{ fontSize: 17 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6 }}>{body}</p>
    </div>
  );
}

function PricePoint({ big, small, dark = false }: { big: string; small: string; dark?: boolean }) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, color: dark ? '#f0edf1' : 'var(--text-primary)' }}>{big}</div>
      <div style={{ fontSize: 13.5, color: dark ? '#857f89' : 'var(--text-tertiary)', marginTop: 2 }}>{small}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div style={{ padding: '18px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <h3 style={{ fontSize: 17, fontFamily: 'var(--font-body)', fontWeight: 700 }}>{q}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>{a}</p>
    </div>
  );
}
