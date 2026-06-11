'use client';

import { useAuth } from '@clerk/nextjs';
import type { DealDetail } from '@gloe/api-client';
import { useState } from 'react';

import { trpc } from '../../lib/trpc';
import { EmbeddedCheckoutModal } from './EmbeddedCheckoutModal';
import { discountPct, formatCredit, formatExpiry, formatPrice } from './format';
import { Share } from './icons';
import { SharePayModal } from './SharePayModal';
import { useBuy } from './useBuy';

/** Stripe refuses charges under 50¢ — mirror the server's split-tender floor
 *  so the previewed credit/cash split matches what actually gets charged. */
const STRIPE_MIN_CHARGE_CENTS = 50;

/**
 * Purchase card for the deal page — variant picker, quantity, price breakdown,
 * Buy now and Share to pay. "Buy now" opens an in-page embedded Stripe checkout
 * (a centered modal on desktop, a bottom sheet on mobile) — the customer never
 * leaves gloe.app. Rendered as a sticky card in the desktop right column and
 * inline on mobile.
 */
export function PurchasePanel({
  deal,
  variantId,
  setVariantId,
  qty,
  setQty,
}: {
  deal: DealDetail;
  variantId: string;
  setVariantId: (id: string) => void;
  qty: number;
  setQty: (n: number) => void;
}) {
  const { buy, startShare, shareUrl, closeShare, checkoutSecret, closeCheckout, loading, sharing, error } = useBuy();
  const { isSignedIn } = useAuth();
  const balance = trpc.credits.balance.useQuery(undefined, { enabled: !!isSignedIn });
  const [useCredits, setUseCredits] = useState(true);
  const variant = deal.variants.find((v) => v.id === variantId) ?? deal.variants[0];
  if (!variant) return null;

  const pct = discountPct(variant.originalPriceCents, variant.dealPriceCents);
  const saveCents = (variant.originalPriceCents - variant.dealPriceCents) * qty;
  const totalCents = variant.dealPriceCents * qty;
  const spotsLeft = variant.spotsTotal != null ? variant.spotsTotal - variant.spotsClaimed : null;
  const limit = Math.max(1, deal.perCustomerLimit ?? 1);
  const expiry = formatExpiry(deal.expiresAt);

  // Credits preview (GLO-24). The server recomputes authoritatively inside the
  // checkout transaction — this only mirrors its rules so the button shows the
  // real cash amount: locked welcome credit counts when this order meets its
  // first-booking floor; never leave 0 < cash < 50¢ (shave credits instead).
  const b = balance.data;
  const unlockedWelcomeCents = b && !b.frozen && b.lockedCents > 0 && totalCents >= b.lockedFloorCents ? b.lockedCents : 0;
  const spendableCents = b && !b.frozen ? b.availableCents + unlockedWelcomeCents : 0;
  let creditPreviewCents = Math.min(spendableCents, totalCents);
  if (totalCents - creditPreviewCents > 0 && totalCents - creditPreviewCents < STRIPE_MIN_CHARGE_CENTS) {
    creditPreviewCents = Math.max(0, totalCents - STRIPE_MIN_CHARGE_CENTS);
  }
  const appliedCents = useCredits ? creditPreviewCents : 0;
  const cashCents = totalCents - appliedCents;

  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 22,
        boxShadow: '0 8px 30px rgba(43,32,25,0.08)',
      }}
    >
      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatPrice(variant.dealPriceCents)}
        </span>
        {pct > 0 ? (
          <span style={{ fontSize: 17, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
            {formatPrice(variant.originalPriceCents)}
          </span>
        ) : null}
        {pct > 0 ? (
          <span style={{ marginLeft: 'auto', background: 'var(--brand-100)', color: 'var(--brand-600)', fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
            {pct}% off
          </span>
        ) : null}
      </div>

      {/* Variant picker */}
      {deal.variants.length > 1 ? (
        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Option</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {deal.variants.map((v) => {
              const active = v.id === variant.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: active ? '2px solid var(--brand-500)' : '1px solid var(--border-default)',
                    background: active ? 'var(--brand-50)' : 'var(--surface-elevated)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{v.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(v.dealPriceCents)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Quantity */}
      {limit > 1 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Stepper label="−" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} />
            <span style={{ fontSize: 16, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{qty}</span>
            <Stepper label="+" onClick={() => setQty(Math.min(limit, qty + 1))} disabled={qty >= limit} />
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 14 }}>Limit 1 per customer</p>
      )}

      {/* Credits (GLO-24) — inline in the price math, defaults on. The client
          only sends the toggle; the server computes the actual amount. */}
      {spendableCents > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, padding: '12px 14px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Use your Gloē credit</div>
            <div style={{ fontSize: 12.5, color: useCredits ? 'var(--brand-700)' : 'var(--text-tertiary)', fontWeight: 600, marginTop: 2 }}>
              {useCredits ? `−${formatCredit(appliedCents)} applied` : `${formatCredit(creditPreviewCents)} available`}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useCredits}
            aria-label="Use your Gloē credit"
            onClick={() => setUseCredits((v) => !v)}
            style={{ position: 'relative', width: 44, height: 26, flexShrink: 0, borderRadius: 'var(--radius-pill)', border: 'none', background: useCredits ? 'var(--brand-500)' : 'var(--border-default)', cursor: 'pointer', transition: 'background 0.15s' }}
          >
            <span style={{ position: 'absolute', top: 3, left: useCredits ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(43,32,25,0.25)', transition: 'left 0.15s' }} />
          </button>
        </div>
      ) : null}

      {/* Buy */}
      <button
        type="button"
        disabled={loading}
        onClick={() => buy(variant.id, qty, useCredits)}
        style={{
          width: '100%',
          marginTop: 18,
          background: 'var(--brand-500)',
          color: 'var(--text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          padding: '15px 20px',
          fontSize: 16,
          fontWeight: 700,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? 'Starting secure checkout…'
          : appliedCents > 0 && cashCents === 0
            ? 'Redeem with credit — nothing to pay'
            : appliedCents > 0
              ? `Buy now · ${formatCredit(cashCents)}`
              : `Buy now · ${formatPrice(totalCents)}`}
      </button>

      <button
        type="button"
        disabled={sharing}
        onClick={() => startShare(variant.id, qty)}
        style={{
          width: '100%',
          marginTop: 10,
          background: 'transparent',
          color: 'var(--brand-600)',
          border: 'none',
          padding: '8px',
          fontSize: 14.5,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
        }}
      >
        <Share size={16} color="var(--brand-600)" /> {sharing ? 'Creating link…' : 'Share to pay'}
      </button>
      <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 2, lineHeight: 1.45 }}>
        Not treating yourself? Send a link — someone else pays, the voucher’s still yours.
      </p>

      {error ? <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 8, textAlign: 'center' }}>{error}</p> : null}

      <SharePayModal url={shareUrl} onClose={closeShare} />

      {/* In-page Stripe checkout — opens when "Buy now" succeeds. Modal on
          desktop, bottom sheet on mobile. The customer never leaves gloe.app. */}
      {checkoutSecret ? <EmbeddedCheckoutModal clientSecret={checkoutSecret} onClose={closeCheckout} /> : null}

      {/* Reassurance */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {saveCents > 0 ? <div>You save {formatPrice(saveCents)}</div> : null}
        {spotsLeft != null && spotsLeft <= 10 ? <div>{spotsLeft <= 0 ? 'Sold out' : `Only ${spotsLeft} left`}</div> : null}
        {expiry ? <div>{expiry}</div> : null}
        <div style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>3-day hassle-free refund · QR voucher delivered instantly</div>
      </div>
    </div>
  );
}

function Stepper({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-elevated)',
        color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
        fontSize: 20,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}
