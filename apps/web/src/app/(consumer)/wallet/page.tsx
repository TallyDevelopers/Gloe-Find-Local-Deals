'use client';

import type { Claim } from '@gloe/api-client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Check, ChevronRight, Star } from '../../../components/consumer/icons';
import { CreditBalanceCard } from '../../../components/consumer/CreditBalanceCard';
import { formatExpiry, formatPrice } from '../../../components/consumer/format';
import { ReferralCard } from '../../../components/consumer/ReferralCard';
import { ReviewModal } from '../../../components/consumer/ReviewModal';
import { trpc } from '../../../lib/trpc';

function isActive(c: Claim): boolean {
  return c.status === 'active' && new Date(c.expiresAt).getTime() > Date.now();
}

function WalletInner() {
  const params = useSearchParams();
  const justPurchased = params.get('purchased') === '1';
  const claims = trpc.claims.list.useQuery();
  // The claim whose review modal is open (null = closed).
  const [reviewClaim, setReviewClaim] = useState<Claim | null>(null);

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

      {/* Credits (GLO-24): balance + invite, above the vouchers. */}
      <CreditBalanceCard />
      <ReferralCard />

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
                <VoucherRow key={c.id} claim={c} dim onReview={() => setReviewClaim(c)} />
              ))}
            </Section>
          ) : null}
        </>
      )}

      <ReviewModal
        claimId={reviewClaim?.id ?? null}
        vendorName={reviewClaim?.snapshot.vendorName ?? 'the vendor'}
        onClose={() => setReviewClaim(null)}
        onSaved={() => claims.refetch()}
      />
    </div>
  );
}

function VoucherRow({ claim, dim, onReview }: { claim: Claim; dim?: boolean; onReview?: () => void }) {
  const expiry = formatExpiry(claim.expiresAt);
  const statusLabel = claim.status === 'redeemed' ? 'Redeemed' : claim.status === 'active' ? expiry : 'Expired';
  // Inline review prompt right under any redeemed-and-unreviewed voucher — one
  // row per deal, so it scales no matter how many redemptions go unreviewed.
  const canReview = !!onReview && claim.status === 'redeemed' && !claim.hasReview;

  return (
    <div className="deal-card" style={{ overflow: 'hidden', border: canReview ? '1px solid var(--brand-100)' : undefined, padding: 0 }}>
      <Link
        href={`/wallet/${claim.id}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '16px 18px', color: 'inherit', opacity: dim && !canReview ? 0.6 : 1 }}
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

      {canReview ? (
        <button
          type="button"
          onClick={onReview}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '13px 18px', borderTop: '1px solid var(--brand-100)', background: 'var(--brand-100)', color: 'var(--brand-700)', font: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
        >
          <Star size={16} color="var(--brand-700)" fill="var(--brand-700)" />
          <span style={{ flex: 1 }}>How was {claim.snapshot.vendorName}? Leave a review</span>
          <ChevronRight size={16} color="var(--brand-700)" />
        </button>
      ) : null}
    </div>
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
