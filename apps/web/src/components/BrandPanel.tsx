import { PhoneMock } from './consumer/GetTheApp';
import { Wordmark } from './Wordmark';

/**
 * Left-side brand panel for the business signup screen. Sticky, full-height,
 * editorial: headline + the pay-per-sale pitch on the app's dark theme (cool
 * ink-mauve, see packages/ui tokens.ts colorDark — rose gold glows on it),
 * with the homepage's iPhone render cropped into the bottom edge. Hidden on
 * narrow screens.
 */
export function BrandPanel() {
  return (
    <div className="biz-brand-panel">
      <div style={{ zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Wordmark size={30} tone="gold" />
          <span className="biz-brand-eyebrow">FOR BUSINESS</span>
        </div>

        <h2 className="biz-brand-headline" style={{ marginTop: 56 }}>
          Your quiet hours,
          <br />
          booked.
        </h2>
        <p className="biz-brand-sub" style={{ marginTop: 16, marginBottom: 40 }}>
          Gloē puts your open slots in front of clients searching for med-spa
          deals near you — right now.
        </p>

        <div className="biz-value-row">
          <span className="biz-value-num">01</span>
          <div>
            <strong>No subscription, ever</strong>
            <p>No monthly fee, no listing fee. Gloē only earns a cut when you get paid.</p>
          </div>
        </div>
        <div className="biz-value-row">
          <span className="biz-value-num">02</span>
          <div>
            <strong>You stay in control</strong>
            <p>Set the price, the quantity, the dates. Pause a deal anytime.</p>
          </div>
        </div>
        <div className="biz-value-row">
          <span className="biz-value-num">03</span>
          <div>
            <strong>Paid out fast</strong>
            <p>Payments land in your bank account through Stripe.</p>
          </div>
        </div>
      </div>

      <div className="biz-phone-wrap">
        <PhoneMock discounts={false} />
      </div>
    </div>
  );
}
