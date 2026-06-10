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
 * product docs (HOW-IT-WORKS.md / GLOE.md): pay-on-redemption, license
 * verification, human-reviewed listings, dispute auto-freeze, Stripe payouts.
 * Dark hero matches the vendor signup brand panel so landing → auth → setup
 * reads as one continuous flow. Public; CTAs route into the vendor portal.
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: '#c2bcc4' }}>gloe.app</Link>
            <SignedOut>
              <Link href="/sign-in?redirect_url=/vendor" style={{ fontSize: 14, fontWeight: 600, color: '#c2bcc4' }}>Sign in</Link>
              <Link href="/sign-up?redirect_url=/vendor" style={cta('sm')}>Get started</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/vendor" style={cta('sm')}>Go to dashboard</Link>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero — dark ink-mauve, same family as the vendor signup panel */}
      <section className="bl-hero">
        <div className="bl-hero-grid">
          <div className="bl-hero-copy">
            <span style={{ ...eyebrow, color: '#ddab9c' }}>Built for spas &amp; med-spas</span>
            <h1 style={{ marginTop: 16 }}>Your quiet hours, booked.</h1>
            <p className="bl-hero-sub">
              List your treatments on Gloē and reach clients searching nearby. They pay up front,
              you scan their voucher at check-in, and the payout releases the moment you redeem —{' '}
              <strong>no monthly fees, no upfront cost.</strong>
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <SignedOut>
                <Link href="/sign-up?redirect_url=/vendor" className="bl-cta-primary">Get started — it&rsquo;s free</Link>
                <Link href="/sign-in?redirect_url=/vendor" className="bl-cta-ghost">Sign in</Link>
              </SignedOut>
              <SignedIn>
                <Link href="/vendor" className="bl-cta-primary">Go to your dashboard</Link>
              </SignedIn>
            </div>
            <p className="bl-hero-note">
              One small fee, only when a deal sells. You keep the rest.
            </p>
          </div>
          <div className="bl-hero-phone" aria-hidden>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Trust strip — vendor-facing mirror of the consumer one */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0' }}>
        <div className="trust-strip">
          <TrustItem icon={<ShieldCheck size={22} color="var(--brand-600)" />} title="License-verified" body="Every spa is checked by a human — clients book with confidence" />
          <TrustItem icon={<Zap size={22} color="var(--brand-600)" />} title="Paid on redemption" body="Your payout releases the moment you scan the voucher" />
          <TrustItem icon={<Lock size={22} color="var(--brand-600)" />} title="Dispute protection" body="A chargeback freezes the voucher instantly — no free treatments" />
          <TrustItem icon={<Star size={22} color="var(--brand-600)" />} title="Human-reviewed" body="Nothing goes live on Gloē without a person approving it" />
        </div>
      </div>

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px 0' }}>
        <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30 }}>Up and running in minutes</h2>
        </div>
        <div className="value-grid" style={{ padding: '20px 0 0' }}>
          <Step n="1" title="Create your free account" body="Under a minute — name, phone, address. No contracts, no card required, no Stripe paperwork up front." />
          <Step n="2" title="Build your first deal" body="Set your price, options, and spots. Start it as a private draft before you’re even verified — type the title and the treatment tags itself." />
          <Step n="3" title="Get verified & go live" body="Submit your license once; a human reviews it (and every deal) before anything reaches clients. That review is what makes Gloē feel premium — and why clients trust your listing." />
          <Step n="4" title="Scan, redeem, get paid" body="Scan their QR at check-in and your payout releases immediately. Free daily payouts via Stripe — or instant payout to your debit card in about 30 minutes." />
        </div>
      </section>

      {/* Why Gloē */}
      <section className="value-band" style={{ marginTop: 56 }}>
        <div className="value-grid">
          <Benefit Icon={Wallet} title="No monthly fees" body="$0 to join, $0 monthly, no minimums. Gloē only earns a small fee when a deal actually sells." />
          <Benefit Icon={ShieldCheck} title="No-show-proof revenue" body="Clients pay when they book, and the voucher only redeems when you scan it. A no-show never costs you a refund." />
          <Benefit Icon={MapPin} title="Reach local clients" body="Clients browsing nearby see your deal in the app, on the map, and in search — and can get pinged the moment it drops." />
          <Benefit Icon={Zap} title="Fill slow days" body="Move last-minute and off-peak inventory without slashing your everyday prices or cheapening your brand." />
          <Benefit Icon={Star} title="Win reviews & regulars" body="First visits turn into 5-star reviews and repeat clients — the goal is the second booking, not just the first." />
          <Benefit Icon={Check} title="Transparent pricing" body="One per-sale fee, visible up front — and the fee on a sale is locked in when it happens, never changed after the fact." />
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 0', textAlign: 'center' }}>
        <span style={eyebrow}>Pricing</span>
        <h2 style={{ fontSize: 32, marginTop: 12 }}>Simple, pay-as-you-go</h2>
        <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 14 }}>
          No subscription. No setup fee. No monthly minimum. Gloē takes one small fee when a customer
          buys one of your deals, and you keep the rest, paid out through
          Stripe. Standard payouts are free; instant payout to a debit card is there when you need
          cash fast.
        </p>
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, marginTop: 24 }}>
          <PricePoint big="$0" small="to join" />
          <PricePoint big="$0" small="monthly" />
          <PricePoint big="Per sale" small="one small fee, only when you’re paid" />
        </div>
      </section>

      {/* Built to protect your business — sourced from the money/trust pipeline */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 0' }}>
        <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30 }}>Built to protect your business</h2>
        </div>
        <div className="value-grid" style={{ padding: '20px 0 0' }}>
          <Feature title="Verified means verified" body="Your license is checked by a human against the issuing state board — and the document lives in private storage, never on a public URL. Clients see a marketplace they can trust, and you’re part of it." />
          <Feature title="Every listing human-approved" body="Deals are reviewed by a person before they reach customers, and editing a live deal sends it back through review. No bait-and-switch can share a page with you." />
          <Feature title="Chargeback armor" body="The moment a card dispute opens, every unredeemed voucher on that order freezes automatically — nobody disputes a payment and still walks in for the treatment." />
          <Feature title="Clean books" body="Refunds before redemption never touch your payout — you were never paid, so nothing claws back. Money you’ve earned shows in your dashboard down to the dollar." />
        </div>
      </section>

      {/* What you can post */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 0' }}>
        <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30 }}>Everything you need to list</h2>
        </div>
        <div className="value-grid" style={{ padding: '20px 0 0' }}>
          <Feature title="Multiple options" body="Offer variants — e.g. 20, 40, or 60 units — each with its own price and spot count." />
          <Feature title="Photos & video" body="Show your space and results with a gallery and short clips that build trust." />
          <Feature title="Your providers" body="Introduce the injector or esthetician with a bio and photo, so clients know who they’ll see." />
          <Feature title="Auto-tagging" body="Type “Botox — first-timer special” and the listing tags the treatment for you, so search always finds you. It suggests; you stay in charge." />
          <Feature title="Smart limits" body="Per-customer and lifetime caps, spot counts, and expirations keep deals on your terms. Pause or edit anytime." />
          <Feature title="Payouts & reporting" body="Today’s sales, money queued for transfer, and your live Stripe balance — one dashboard, no spreadsheet." />
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 0' }}>
        <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30 }}>Questions, answered</h2>
        </div>
        <div style={{ marginTop: 16 }}>
          <Faq q="How much does it cost?" a="Nothing to join and no monthly fee. Gloē takes one small fee only when a customer buys one of your deals, and the fee that applies to a sale is locked in at purchase — never retroactively changed. You keep the rest." />
          <Faq q="When do I get paid?" a="Your payout releases the moment you redeem a voucher. Standard payouts land via Stripe on a daily schedule, free. Need it faster? Instant payout sends cash to a linked debit card in about 30 minutes." />
          <Faq q="What’s the verification process?" a="You submit your license — number, state, type, and a photo or PDF — from your dashboard. It’s stored privately and reviewed by a human against the state board. Approval is the moment your spa goes live, and if something’s off you see the exact reason and can resubmit." />
          <Faq q="What if a customer doesn’t show?" a="They’ve already paid, and the voucher only redeems when you scan it — a no-show never becomes a refund out of your pocket. Unredeemed vouchers expire on the date you set." />
          <Faq q="What about chargebacks?" a="The instant a dispute opens, every unredeemed voucher on that order freezes automatically — your scanner will say the voucher is on hold, so nobody disputes a payment and still gets the service." />
          <Faq q="Do I need a special app?" a="No — you manage everything from the Gloē business portal on the web: post deals, scan QR codes to redeem, track payouts. No extra hardware." />
          <Faq q="Will this cheapen my brand?" a="No — you set the deal and the terms, and every spa on Gloē is license-verified with human-reviewed listings. This is a curated marketplace built to bring you new regulars, not a coupon dump." />
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-band" style={{ marginTop: 64 }}>
        <h2 style={{ fontSize: 32, maxWidth: 560, margin: '0 auto' }}>Ready to fill your books?</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 17, maxWidth: 480, marginInline: 'auto' }}>
          Join Gloē free and post your first deal today. New clients are searching nearby right now.
        </p>
        <SignedOut>
          <Link href="/sign-up?redirect_url=/vendor" style={{ ...cta('lg'), marginTop: 24 }}>Get started — it&rsquo;s free</Link>
        </SignedOut>
        <SignedIn>
          <Link href="/vendor" style={{ ...cta('lg'), marginTop: 24 }}>Go to your dashboard</Link>
        </SignedIn>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 56, padding: '28px 24px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
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

function cta(size: 'sm' | 'lg', secondary = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    borderRadius: 'var(--radius-pill)',
    fontSize: size === 'lg' ? 16 : 14,
    padding: size === 'lg' ? '14px 28px' : '9px 18px',
    background: secondary ? 'var(--surface-elevated)' : 'var(--brand-500)',
    color: secondary ? 'var(--text-primary)' : 'var(--text-inverse)',
    border: secondary ? '1px solid var(--border-default)' : 'none',
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

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="value-card">
      <div className="value-icon" style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--brand-600)' }}>{n}</div>
      <h3 style={{ fontSize: 19, marginTop: 2 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 8, maxWidth: 300, marginInline: 'auto' }}>{body}</p>
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

function PricePoint({ big, small }: { big: string; small: string }) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: 'var(--text-primary)' }}>{big}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{small}</div>
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
