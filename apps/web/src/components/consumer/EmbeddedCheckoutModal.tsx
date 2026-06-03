'use client';

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

import { stripePromise } from '../../lib/stripe';
import { X } from './icons';

/**
 * In-page Stripe checkout — the payment form renders right here on gloe.app
 * instead of redirecting to a hosted Stripe page. Centered modal on desktop,
 * bottom sheet on mobile (CSS). On payment success Stripe returns the buyer to
 * the session's return_url (/wallet) and the webhook mints the voucher.
 */
export function EmbeddedCheckoutModal({ clientSecret, onClose }: { clientSecret: string; onClose: () => void }) {
  return (
    <div className="embed-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="embed-modal" onClick={(e) => e.stopPropagation()}>
        <span className="sheet-grabber embed-grabber" aria-hidden />
        <div className="embed-head">
          <span className="embed-title">Secure checkout</span>
          <button type="button" className="embed-close" onClick={onClose} aria-label="Close checkout">
            <X size={20} color="var(--text-primary)" />
          </button>
        </div>
        <div className="embed-body">
          {stripePromise ? (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <p style={{ padding: 24, textAlign: 'center', color: 'var(--error)' }}>
              Payments are misconfigured (missing Stripe key). Please try again later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
