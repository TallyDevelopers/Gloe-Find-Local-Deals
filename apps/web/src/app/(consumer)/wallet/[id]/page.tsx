'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

import { Check, Navigation, Phone } from '../../../../components/consumer/icons';
import { formatExpiry, formatPrice } from '../../../../components/consumer/format';
import { trpc } from '../../../../lib/trpc';

/**
 * A single voucher — the in-person redemption ticket. Shows the QR (the vendor
 * scans `qrPayload`), a human-readable backup code, status, and quick actions
 * (call / directions) pulled from the live vendor record.
 */
export default function VoucherPage() {
  const params = useParams<{ id: string }>();
  const claim = trpc.claims.byId.useQuery({ id: params.id }, { enabled: !!params.id });

  if (claim.isLoading) return <div className="consumer-container" style={{ paddingTop: 40 }}>Loading…</div>;
  if (claim.error || !claim.data) {
    return (
      <div className="consumer-container" style={{ paddingTop: 80, textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>Voucher not found</h1>
        <Link href="/wallet" style={{ display: 'inline-block', marginTop: 14, color: 'var(--brand-600)', fontWeight: 600 }}>← Back to wallet</Link>
      </div>
    );
  }

  const c = claim.data;
  const active = c.status === 'active' && new Date(c.expiresAt).getTime() > Date.now();
  const expiry = formatExpiry(c.expiresAt);
  const v = c.vendor;
  const directionsHref = v?.lat != null && v?.lng != null
    ? `https://maps.apple.com/?daddr=${v.lat},${v.lng}`
    : v?.address ? `https://maps.apple.com/?q=${encodeURIComponent(v.address)}` : null;

  return (
    <div className="consumer-container" style={{ maxWidth: 460, paddingTop: 20 }}>
      <Link href="/wallet" style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>← Wallet</Link>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{c.snapshot.vendorName}</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{c.snapshot.dealTitle} · {c.snapshot.variantLabel}</div>
      </div>

      <div
        style={{
          marginTop: 20,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(43,32,25,0.08)',
        }}
      >
        {active ? (
          <>
            <div style={{ display: 'inline-block', padding: 14, background: '#fff', borderRadius: 'var(--radius-md)' }}>
              <QRCodeSVG value={c.qrPayload} size={196} fgColor="#2b2019" bgColor="#ffffff" level="M" />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 18 }}>CODE</div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.12em', marginTop: 4 }}>{c.humanCode}</div>
          </>
        ) : c.status === 'redeemed' ? (
          <div style={{ padding: '24px 0' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(122,139,92,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={36} color="var(--success)" />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 14 }}>Redeemed</div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Hope you loved it ✨</p>
          </div>
        ) : (
          <div style={{ padding: '24px 0' }}>
            <div style={{ fontSize: 40 }}>⌛</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginTop: 8 }}>Expired</div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>This voucher is no longer valid.</p>
          </div>
        )}

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)' }}>
          <span>You paid</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(c.snapshot.dealPriceCents)}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {v?.phone ? (
          <a href={`tel:${v.phone}`} style={actionStyle}><Phone size={16} color="var(--brand-600)" /> Call</a>
        ) : null}
        {directionsHref ? (
          <a href={directionsHref} target="_blank" rel="noreferrer" style={actionStyle}><Navigation size={16} color="var(--brand-600)" /> Directions</a>
        ) : null}
      </div>

      {active ? (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>How to use</div>
          <ol style={{ paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14.5 }}>
            <li>Book your appointment with the spa.</li>
            <li>Show this QR code (or the code above) at check-in.</li>
            <li>Enjoy — payment’s already handled.</li>
          </ol>
          {expiry ? <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--text-tertiary)' }}>{expiry}</p> : null}
        </div>
      ) : null}

      <Link href={`/spa/${c.snapshot.vendorId}`} style={{ display: 'inline-block', marginTop: 20, color: 'var(--brand-600)', fontWeight: 600 }}>
        Visit {c.snapshot.vendorName} →
      </Link>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        This code is unique to your account. Please don’t share it.
      </p>
    </div>
  );
}

const actionStyle: React.CSSProperties = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '12px 16px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 600,
};
