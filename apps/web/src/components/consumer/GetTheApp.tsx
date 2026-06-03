import { Wordmark } from '../Wordmark';
import { Bookmark, Check, Clock, Heart, MapPin, Search, Sparkles, Star, User, Wallet } from './icons';

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

function PhoneMock() {
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

        {/* App header */}
        <div style={{ padding: '4px 14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Wordmark size={17} tone="gold" />
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--brand-100)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} color="var(--brand-600)" />
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 600 }}>
            <MapPin size={12} color="var(--brand-600)" /> Encinitas, CA
          </div>

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)' }}>
            <Search size={13} color="var(--text-tertiary)" />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Search treatments</span>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflow: 'hidden' }}>
            {[
              { label: 'All', active: true },
              { label: 'Botox', active: false },
              { label: 'Skin', active: false },
              { label: 'Laser', active: false },
            ].map((p) => (
              <span
                key={p.label}
                style={{
                  flexShrink: 0,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: p.active ? 'var(--brand-500)' : 'var(--surface-elevated)',
                  color: p.active ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  border: p.active ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* Deal cards */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MiniDeal
            photo="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=70"
            fallback="linear-gradient(135deg,#f6e4de,#e8b4ab)"
            treatment="BOTOX"
            title="Botox — 20, 40 or 60 units"
            price="$169"
            was="$260"
            vendor="Encinitas Glow Co"
            rating="4.9"
            reviews="142"
            time="12 min"
            miles="2.3 mi"
            off="35%"
          />
          <MiniDeal
            photo="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=400&q=70"
            fallback="linear-gradient(135deg,#efe7df,#d9c3b6)"
            treatment="HYDRAFACIAL"
            title="Signature Hydrafacial glow"
            price="$129"
            was="$199"
            vendor="The Skin Lounge"
            rating="4.8"
            reviews="86"
            time="9 min"
            miles="1.4 mi"
            off="35%"
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

function MiniDeal({ photo, fallback, treatment, title, price, was, vendor, rating, reviews, time, miles, off }: { photo: string; fallback: string; treatment: string; title: string; price: string; was: string; vendor: string; rating: string; reviews: string; time: string; miles: string; off: string }) {
  return (
    <div style={{ background: 'var(--surface-elevated)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(43,32,25,0.06)' }}>
      {/* Real photo with a brand gradient underneath as a graceful fallback */}
      <div style={{ position: 'relative', height: 84, backgroundImage: `url(${photo}), ${fallback}`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <span style={{ position: 'absolute', top: 7, left: 7, background: 'var(--brand-500)', color: 'var(--text-inverse)', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>{off} off</span>
        <span style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-elevated)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(43,32,25,0.18)' }}>
          <Heart size={12} color="var(--text-primary)" />
        </span>
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{treatment}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, color: 'var(--text-primary)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{price}</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>{was}</span>
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vendor}</div>
        {/* Reviews + distance + drive time, like the real card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 9, color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <Star size={9} color="var(--gold)" fill="var(--gold)" strokeWidth={0} />
            {rating} ({reviews})
          </span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <Clock size={9} color="var(--text-tertiary)" /> {time}
          </span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <MapPin size={9} color="var(--text-tertiary)" /> {miles}
          </span>
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
