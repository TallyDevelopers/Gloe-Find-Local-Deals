'use client';

import type { Claim } from '@gloe/api-client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { Check } from '../../../components/consumer/icons';
import { formatExpiry, formatPrice } from '../../../components/consumer/format';
import { trpc } from '../../../lib/trpc';

function isActive(c: Claim): boolean {
  return c.status === 'active' && new Date(c.expiresAt).getTime() > Date.now();
}

function WalletInner() {
  const params = useSearchParams();
  const justPurchased = params.get('purchased') === '1';
  const claims = trpc.claims.list.useQuery();

  const active = (claims.data ?? []).filter(isActive).sort((a, b) => +new Date(a.expiresAt) - +new Date(b.expiresAt));
  const past = (claims.data ?? []).filter((c) => !isActive(c)).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>Wallet</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Your ready-to-use bookings.</p>

      {justPurchased ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(122,139,92,0.12)', border: '1px solid var(--success)', color: 'var(--text-primary)' }}>
          <Check size={18} color="var(--success)" /> Payment complete — your voucher is ready below.
        </div>
      ) : null}

      {claims.isLoading ? (
        <p style={{ color: 'var(--text-tertiary)', marginTop: 24 }}>Loading…</p>
      ) : active.length === 0 && past.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-secondary)' }}>
          <p>No vouchers yet. When you buy a deal, it lands here instantly.</p>
          <Link href="/" style={{ display: 'inline-block', marginTop: 14, color: 'var(--brand-600)', fontWeight: 600 }}>Browse deals →</Link>
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <Section label="Ready to redeem">
              {active.map((c) => (
                <VoucherRow key={c.id} claim={c} />
              ))}
            </Section>
          ) : null}
          {past.length > 0 ? (
            <Section label="Past">
              {past.map((c) => (
                <VoucherRow key={c.id} claim={c} dim />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function VoucherRow({ claim, dim }: { claim: Claim; dim?: boolean }) {
  const expiry = formatExpiry(claim.expiresAt);
  const statusLabel = claim.status === 'redeemed' ? 'Redeemed' : claim.status === 'active' ? expiry : 'Expired';
  return (
    <Link
      href={`/wallet/${claim.id}`}
      className="deal-card"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 18px', color: 'inherit', opacity: dim ? 0.62 : 1 }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>{claim.snapshot.vendorName}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.snapshot.dealTitle}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
          {claim.snapshot.variantLabel} · {formatPrice(claim.snapshot.dealPriceCents)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '5px 11px',
            borderRadius: 'var(--radius-pill)',
            background: claim.status === 'active' ? 'var(--brand-100)' : 'var(--surface-secondary)',
            color: claim.status === 'active' ? 'var(--brand-600)' : 'var(--text-tertiary)',
          }}
        >
          {statusLabel}
        </span>
      </div>
    </Link>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="consumer-container" style={{ paddingTop: 24 }}>Loading…</div>}>
      <WalletInner />
    </Suspense>
  );
}
