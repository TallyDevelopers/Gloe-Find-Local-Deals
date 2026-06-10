import { Bookmark, Check, ChevronDown, Clock, Heart, Map, MapPin, Search, Sparkles, Star, User, Wallet } from './icons';

/**
 * "Get the app" marketing band: value copy + App Store / Google Play badges on
 * the left, and a faithful in-CSS iPhone render of the Gloē app on the right
 * (status bar, location header, search, category pills, deal cards, bottom tab
 * bar, dynamic island + home indicator). The phone is hidden on small screens.
 */
export function GetTheApp() {
  return (
    <section className="app-band">
      <div className="app-band-inner">
        <div className="app-copy-col">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--brand-600)',
            }}
          >
            <Sparkles size={15} color="var(--brand-600)" /> The Gloē app
          </span>
          <h2 style={{ fontSize: 38, lineHeight: 1.08, marginTop: 12, maxWidth: 460 }}>Take Gloē with you</h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 14, maxWidth: 440 }}>
            Your vouchers in Apple Wallet, one‑tap Apple Pay checkout, and a ping the moment a deal drops near you.
          </p>

          <ul className="app-checks" style={{ listStyle: 'none', margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            {['Apple Wallet passes — your QR, always handy', 'Apple Pay checkout in one tap', 'Get notified when new deals land nearby'].map((t) => (
              <li key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--text-secondary)', fontSize: 15 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  <Check size={17} color="var(--success)" />
                </span>
                {t}
              </li>
            ))}
          </ul>

          <div className="app-cta" style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
            <AppStoreBadge />
          </div>
        </div>

        <div className="app-phone-col">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- iPhone mock ------------------------------ */

/**
 * Exported for reuse on the business signup brand panel + /business hero.
 * `discounts={false}` hides the %-off badges and strikethrough prices — the
 * vendor-facing pages pitch "fill quiet hours without slashing prices", so
 * the demo data there shouldn't scream discounts. Layout stays identical to
 * the real app either way.
 */
export function PhoneMock({ discounts = true }: { discounts?: boolean }) {
  return (
    <div
      className="phone-mock"
      style={{
        width: 280,
        height: 574,
        background: '#100c0a',
        borderRadius: 46,
        padding: 11,
        boxShadow: '0 30px 70px rgba(43,32,25,0.32), inset 0 0 2px 2px rgba(255,255,255,0.08)',
        position: 'relative',
      }}
    >
      {/* Screen */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: 'var(--surface-primary)',
          borderRadius: 36,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // The marketing band centers its text; a real screen is left-aligned.
          // Reset here so the location pill, pills, and card text all sit left.
          textAlign: 'left',
        }}
      >
        {/* Dynamic island */}
        <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 90, height: 26, background: '#000', borderRadius: 999, zIndex: 5 }} />

        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
          <span>9:41</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Bars />
            <Wifi />
            <Battery />
          </span>
        </div>

        {/* App header — mirrors the real Discover screen: one row with the
            search bar (location folded in as a tappable left segment) and the
            square brand map button beside it (ResortPass pattern). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 0' }}>
          {/* Search bar with "📍 Near you │ Search…" left segment */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '10px 11px', borderRadius: 999, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
              <MapPin size={12} color="var(--brand-600)" /> Near you <ChevronDown size={10} color="var(--text-tertiary)" />
            </span>
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-subtle)' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <Search size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search Botox, filler…</span>
            </span>
          </div>
          {/* Square map-view button */}
          <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: 'var(--brand-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(43,32,25,0.18)' }}>
            <Map size={17} color="#fff" />
          </span>
        </div>

        {/* Deal feed — one full-width hero card like the real DealCardLarge, with
            the next card peeking below (the app's centered, scrollable feel). */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <LargeDeal
            photo="https://xmjwrjvyiblinlnoszeh.supabase.co/storage/v1/object/public/deal-photos/samples/peptides-sermorelin.jpg"
            fallback="linear-gradient(135deg,#f3e7e0,#e3c3b4)"
            treatment="HORMONES & PEPTIDES"
            title="Sermorelin Peptide Therapy — recovery & anti‑aging"
            price="$249"
            was={discounts ? '$399' : undefined}
            unit="1 month"
            vendor="Glow House Wellness"
            rating="4.9"
            reviews="188"
            time="12 min"
            miles="4.9 mi"
            off={discounts ? '38%' : undefined}
          />
          <LargeDeal
            photo="https://xmjwrjvyiblinlnoszeh.supabase.co/storage/v1/object/public/deal-photos/d6253710-a06b-4a3f-85b4-762af02b25f9/0ea48d51-11c8-484b-a24e-0699983b428f.jpg"
            fallback="linear-gradient(135deg,#f6e4de,#e8b4ab)"
            treatment="INJECTABLES"
            title="Botox — 20, 40 or 60 units"
            price="$169"
            was={discounts ? '$260' : undefined}
            unit="20 units"
            vendor="Encinitas Glow Co"
            rating="4.9"
            reviews="142"
            time="12 min"
            miles="2.3 mi"
            off={discounts ? '35%' : undefined}
          />
        </div>

        {/* Bottom tab bar */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)', paddingBottom: 14, paddingTop: 8 }}>
          <MiniTab Icon={Sparkles} label="Discover" active />
          <MiniTab Icon={Bookmark} label="Saved" />
          <MiniTab Icon={Wallet} label="Wallet" />
          <MiniTab Icon={User} label="Profile" />
        </div>
        {/* Home indicator */}
        <div style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', width: 110, height: 4.5, borderRadius: 999, background: 'var(--text-primary)', opacity: 0.5 }} />
      </div>
    </div>
  );
}

/** Faithful mini of the app's full-width DealCardLarge: big image, discount
 *  badge + heart, then category / title / price / vendor / rating row.
 *  `was`/`off` optional — omitted on vendor-facing surfaces. */
function LargeDeal({ photo, fallback, treatment, title, price, was, unit, vendor, rating, reviews, time, miles, off }: { photo: string; fallback: string; treatment: string; title: string; price: string; was?: string; unit: string; vendor: string; rating: string; reviews: string; time: string; miles: string; off?: string }) {
  return (
    <div style={{ flexShrink: 0, background: 'var(--surface-elevated)', borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: '0 2px 10px rgba(43,32,25,0.08)' }}>
      {/* Real photo with a brand gradient underneath as a graceful fallback */}
      <div style={{ position: 'relative', height: 168, backgroundImage: `url(${photo}), ${fallback}`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {off ? (
          <span style={{ position: 'absolute', top: 10, left: 10, background: 'var(--brand-500)', color: 'var(--text-inverse)', fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999 }}>{off} off</span>
        ) : null}
        <span style={{ position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 5px rgba(43,32,25,0.2)' }}>
          <Heart size={15} color="var(--text-primary)" />
        </span>
      </div>
      <div style={{ padding: '12px 13px 13px' }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{treatment}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, lineHeight: 1.15, color: 'var(--text-primary)', marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{price}</span>
          {was ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{was}</span> : null}
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {unit}</span>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>{vendor}</div>
        {/* Reviews · drive time · distance, like the real card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10.5, color: 'var(--text-secondary)' }}>
          <Star size={10} color="var(--gold)" fill="var(--gold)" strokeWidth={0} />
          <span>{rating} ({reviews})</span>
          <span>·</span>
          <Clock size={10} color="var(--text-secondary)" />
          <span>{time}</span>
          <span>·</span>
          <MapPin size={10} color="var(--text-secondary)" />
          <span>{miles}</span>
        </div>
      </div>
    </div>
  );
}

function MiniTab({ Icon, label, active }: { Icon: typeof Sparkles; label: string; active?: boolean }) {
  const color = active ? 'var(--brand-600)' : 'var(--text-tertiary)';
  return (
    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color, fontSize: 8.5, fontWeight: 600 }}>
      <Icon size={17} color={color} strokeWidth={active ? 2.4 : 2} />
      {label}
    </span>
  );
}

/* tiny status-bar glyphs */
function Bars() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1.5, height: 10 }}>
      {[4, 6, 8, 10].map((h) => (
        <span key={h} style={{ width: 2.5, height: h, background: 'var(--text-primary)', borderRadius: 1 }} />
      ))}
    </span>
  );
}
function Wifi() {
  return <span style={{ width: 13, height: 10, marginLeft: 1, background: 'var(--text-primary)', WebkitMaskImage: 'radial-gradient(circle at 50% 100%, #000 32%, transparent 33%)', maskImage: 'radial-gradient(circle at 50% 100%, #000 32%, transparent 33%)', display: 'inline-block' }} />;
}
function Battery() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <span style={{ width: 20, height: 10, borderRadius: 3, border: '1px solid var(--text-primary)', padding: 1.5, display: 'inline-flex' }}>
        <span style={{ flex: 1, background: 'var(--text-primary)', borderRadius: 1 }} />
      </span>
      <span style={{ width: 1.5, height: 4, background: 'var(--text-primary)', borderRadius: 1 }} />
    </span>
  );
}

/* --------------------------------- badges --------------------------------- */

function AppStoreBadge() {
  return (
    <a href="#" aria-label="Download on the App Store" style={badgeStyle}>
      <svg viewBox="0 0 384 512" width={22} height={22} fill="#fff" aria-hidden>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span style={{ textAlign: 'left', lineHeight: 1.1 }}>
        <span style={{ display: 'block', fontSize: 9, opacity: 0.85 }}>Download on the</span>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>App Store</span>
      </span>
    </a>
  );
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  background: '#000',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 12,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.18)',
};
