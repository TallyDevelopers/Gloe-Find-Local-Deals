'use client';

import { QRCodeSVG } from 'qrcode.react';

import { Check } from '../../components/consumer/icons';

/**
 * Static, backend-free renders of the REAL product UI for the /business page —
 * the voucher a client shows at check-in, the vendor's scan-confirm moment, the
 * dashboard money card, and the auto-tagging post form. Same visual vocabulary
 * as the live screens (wallet/[id], ScanTab, VendorDashboard, PostDealForm),
 * just frozen with demo data. Like PhoneMock, these ARE the marketing art.
 */

const CARD: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  borderRadius: 20,
  border: '1px solid var(--border-subtle)',
  boxShadow: '0 24px 60px rgba(43, 32, 25, 0.18)',
};

/** The client's voucher — QR, backup code, redeem-by. The hero of the cluster. */
export function VoucherShot() {
  return (
    <div style={{ ...CARD, width: 270, padding: '24px 22px', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>GLOĒ VOUCHER</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(122,139,92,0.14)', color: 'var(--success)' }}>Active</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginTop: 12, lineHeight: 1.2 }}>
        Botox — first-timer special
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>Glow Aesthetics La Jolla · 40 units</div>
      <div style={{ display: 'inline-block', padding: 10, background: '#fff', borderRadius: 12, border: '1px solid var(--border-subtle)', marginTop: 14 }}>
        <QRCodeSVG value="gloe:demo:voucher" size={132} fgColor="#2b2019" bgColor="#ffffff" level="M" />
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 12 }}>CODE</div>
      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-primary)', marginTop: 2 }}>GLOE-8F3K</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>Show at check-in · Redeem by Jul 12</div>
    </div>
  );
}

/** The vendor's side of the same moment — scanner verified, one tap to redeem. */
export function ScanShot() {
  return (
    <div style={{ ...CARD, width: 250, padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(122,139,92,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={16} color="var(--success)" />
        </span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>Voucher verified</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Scanned just now</div>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--brand-50)', border: '1px solid var(--brand-100)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Jess M. · Botox — 40 units</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>$169 · GLOE-8F3K</div>
      </div>
      <div style={{ marginTop: 12, padding: '11px 0', borderRadius: 999, background: 'linear-gradient(135deg, var(--brand-500), var(--gold-deep))', color: '#fff', fontSize: 13.5, fontWeight: 700, textAlign: 'center' }}>
        Redeem voucher
      </div>
    </div>
  );
}

/** The dashboard money card — today's sales + the payout that just released. */
export function MoneyShot() {
  return (
    <div style={{ ...CARD, width: 250, padding: '18px 20px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>TODAY</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>$1,294</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>6 sales · 4 redeemed</span>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Queued for transfer</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1 }}>$812.20</div>
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-600)' }}>Instant payout →</span>
      </div>
    </div>
  );
}

/** The post form's auto-tagging moment — type the title, the treatment tags itself. */
export function AutoTagShot() {
  return (
    <div style={{ ...CARD, width: 250, padding: '16px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>NEW DEAL</div>
      <div style={{ marginTop: 9, padding: '11px 13px', borderRadius: 11, border: '1px solid var(--brand-500)', boxShadow: '0 0 0 3px var(--brand-100)', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--surface-elevated)' }}>
        Botox — first-timer special<span style={{ opacity: 0.5 }}>|</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 999, background: 'var(--brand-600)', color: '#fff' }}>
          <Check size={12} color="#fff" /> Botox
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>tagged automatically</span>
      </div>
    </div>
  );
}

/** The overlapping collage for the "one portal" section. */
export function PortalShowcase() {
  return (
    <div className="bl-showcase" aria-hidden>
      <div className="bl-shot bl-shot-voucher"><VoucherShot /></div>
      <div className="bl-shot bl-shot-scan"><ScanShot /></div>
      <div className="bl-shot bl-shot-money"><MoneyShot /></div>
      <div className="bl-shot bl-shot-autotag"><AutoTagShot /></div>
    </div>
  );
}
