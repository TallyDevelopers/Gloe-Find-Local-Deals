import { SignedIn, SignedOut } from '@clerk/nextjs';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Bookmark, Check, MapPin, Sparkles, Star, Wallet } from '../../components/consumer/icons';
import { Wordmark } from '../../components/Wordmark';

export const metadata: Metadata = {
  title: 'For Businesses — fill your chairs with Gloē',
  description:
    'Post your aesthetic deals on Gloē and reach new clients near you. No monthly fees, no upfront cost — you only pay a small fee when a client books. Far less than Groupon.',
};

/**
 * For Businesses — the vendor marketing + info page. Explains what Gloē is, how
 * it works for a spa/medspa, pricing (pay-per-booking, no subscription), what
 * you can post, and an FAQ. Public; CTAs route into the vendor portal.
 */
export default function ForBusinessPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface-primary)' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(250,245,242,0.85)', backdropFilter: 'saturate(140%) blur(14px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" aria-label="Gloē home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Wordmark size={24} tone="gold" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', borderLeft: '1px solid var(--border-default)', paddingLeft: 10 }}>FOR BUSINESS</span>
          </Link>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>← Back to Gloē</Link>
            <SignedOut>
              <Link href="/sign-in?redirect_url=/vendor" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sign in</Link>
              <Link href="/sign-up?redirect_url=/vendor" style={cta('sm')}>Get started</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/vendor" style={cta('sm')}>Go to dashboard</Link>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner" style={{ paddingTop: 72, paddingBottom: 64 }}>
          <span style={eyebrow}>
            <Sparkles size={15} color="var(--brand-600)" /> Built for spas & medspas
          </span>
          <h1 style={{ fontSize: 60, lineHeight: 1.04, marginTop: 16, maxWidth: 760 }}>Turn deal‑seekers into loyal clients.</h1>
          <p style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 600, marginTop: 18 }}>
            List your treatments on Gloē and reach new clients near you. Post a deal, get discovered, and get
            paid when they book — <strong style={{ color: 'var(--text-primary)' }}>no monthly fees, no upfront cost.</strong>
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <SignedOut>
              <Link href="/sign-up?redirect_url=/vendor" style={cta('lg')}>Get started — it’s free</Link>
              <Link href="/sign-in?redirect_url=/vendor" style={cta('lg', true)}>Sign in</Link>
            </SignedOut>
            <SignedIn>
              <Link href="/vendor" style={cta('lg')}>Go to your dashboard</Link>
            </SignedIn>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 16 }}>
            We only earn a small fee when a customer claims one of your deals. Way less than Groupon.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px 0' }}>
        <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30 }}>Up and running in minutes</h2>
        </div>
        <div className="value-grid" style={{ padding: '20px 0 0' }}>
          <Step n="1" title="Create your free account" body="Sign up in a minute — no contracts, no card required. Add your spa’s details and you’re live." />
          <Step n="2" title="Post a deal" body="Pick the treatment, set your price and how many spots. Add photos, provider bios, and the fine print." />
          <Step n="3" title="Get discovered" body="New clients nearby find your deal, pay securely, and get a QR voucher instantly." />
          <Step n="4" title="Scan & get paid" body="Scan their QR to redeem at check‑in. Payouts land via Stripe — instant payout to your debit card available." />
        </div>
      </section>

      {/* Why Gloē */}
      <section className="value-band" style={{ marginTop: 56 }}>
        <div className="value-grid">
          <Benefit Icon={Wallet} title="No monthly fees" body="Pay as you go — a small fee only when a client actually books. Nothing upfront, ever." />
          <Benefit Icon={MapPin} title="Reach local clients" body="Get in front of deal‑seekers searching for botox, facials, laser, and more right in your area." />
          <Benefit Icon={Sparkles} title="Fill slow days" body="Move last‑minute and off‑peak inventory without slashing your everyday prices or brand." />
          <Benefit Icon={Star} title="Win reviews & regulars" body="First visits turn into 5‑star reviews and repeat clients — the goal is the second booking, not just the first." />
          <Benefit Icon={Bookmark} title="You’re in control" body="Set prices, spots, per‑customer limits, and expirations. Pause or edit a deal anytime." />
          <Benefit Icon={Check} title="Way less than Groupon" body="Keep far more of every sale. Transparent, per‑booking pricing with no lock‑in." />
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 0', textAlign: 'center' }}>
        <span style={eyebrow}>Pricing</span>
        <h2 style={{ fontSize: 32, marginTop: 12 }}>Simple, pay‑as‑you‑go</h2>
        <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 14 }}>
          No subscription. No setup fee. No monthly minimum. Gloē only takes a small fee when a customer
          claims one of your deals — and it’s far less than Groupon. You keep the rest, paid out through Stripe.
        </p>
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, marginTop: 24 }}>
          <PricePoint big="$0" small="to join" />
          <PricePoint big="$0" small="monthly" />
          <PricePoint big="Per booking" small="small fee only when you’re paid" />
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
          <Feature title="QR redemption" body="Scan the customer’s QR in the app to redeem — no codes to track by hand." />
          <Feature title="Smart limits" body="Per‑customer and lifetime caps, spot counts, and expirations keep deals on your terms." />
          <Feature title="Payouts & reporting" body="See sales and payouts in your dashboard. Instant payout to a debit card when you need cash fast." />
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 0' }}>
        <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: 30 }}>Questions, answered</h2>
        </div>
        <div style={{ marginTop: 16 }}>
          <Faq q="How much does it cost?" a="Nothing to join and no monthly fee. Gloē takes a small fee only when a customer claims one of your deals — far less than Groupon. You keep the rest." />
          <Faq q="When do I get paid?" a="Payouts run through Stripe after a voucher is redeemed. If you need funds faster, instant payout to a linked debit card is available." />
          <Faq q="Do I need a special app?" a="You manage everything from the Gloē business portal on the web — post deals, scan QR codes to redeem, and track payouts. No extra hardware." />
          <Faq q="What if a customer doesn’t show?" a="They’ve already paid for the voucher, and it only redeems when you scan it. Unredeemed vouchers expire on the date you set." />
          <Faq q="Will this cheapen my brand?" a="No — you set the deal and the terms. Gloē is built to bring in new clients you convert into regulars, not to train your market on discounts." />
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-band" style={{ marginTop: 64 }}>
        <h2 style={{ fontSize: 32, maxWidth: 560, margin: '0 auto' }}>Ready to fill your books?</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 17, maxWidth: 480, marginInline: 'auto' }}>
          Join Gloē free and post your first deal today. New clients are searching nearby right now.
        </p>
        <SignedOut>
          <Link href="/sign-up?redirect_url=/vendor" style={{ ...cta('lg'), marginTop: 24 }}>Get started — it’s free</Link>
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
