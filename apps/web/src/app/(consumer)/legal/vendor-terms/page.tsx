import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Vendor Agreement' };

/**
 * The Gloē Vendor Agreement (GLO-35). Vendors accept this at signup (required
 * checkbox on the create-business form; acceptance + version stamped on the
 * vendor row). The chargeback-liability section is the contractual backing for
 * the GLO-34 dispute auto-clawback. Pending counsel review under GLO-15 —
 * bump VENDOR_TERMS_VERSION in apps/api when this materially changes.
 */
export default function VendorTermsPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Vendor Agreement</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 11, 2026 · Version 2026-06-11</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          This agreement is between Gloē and the business (&ldquo;vendor,&rdquo; &ldquo;you&rdquo;) that creates a vendor
          account on Gloē. By checking the agreement box at signup, or by listing a deal on Gloē, you
          accept these terms.
        </p>

        <Section title="1. Gloē is a marketplace facilitator">
          Gloē operates gloe.app and the Gloē app as a marketplace that connects customers with
          independent beauty and wellness businesses. You — not Gloē — are the merchant of record for
          the services you sell, and you are solely responsible for delivering them, including
          scheduling, quality, safety, staffing, and compliance with the laws and licensing rules that
          apply to your practice. Gloē facilitates discovery, payment, and voucher redemption; we do
          not provide treatments.
        </Section>

        <Section title="2. Eligibility and licensing">
          You must hold (and keep current) every license your services require. Gloē verifies provider
          licenses before your deals can go live and may re-verify at any time. You agree to tell us
          promptly if a license lapses, is suspended, or is revoked. Misrepresenting licensure is
          grounds for immediate termination.
        </Section>

        <Section title="3. Deals and vouchers">
          You set your deal&rsquo;s price, terms, quantity, and per-customer limits. When a customer buys a
          deal, Gloē issues them a voucher (QR code) redeemable at your business. You agree to honor
          every valid, unexpired voucher at the advertised terms, and to redeem vouchers only through
          the Gloē redemption flow — that scan is what releases your payout.
        </Section>

        <Section title="4. Fees and payouts">
          Gloē charges a platform fee per transaction; the fee schedule in effect is shown to you when
          you create a deal and is snapshotted on each sale. Payouts of your share are made through
          Stripe Connect after a voucher is redeemed. You must maintain a Stripe account in good
          standing to receive payouts.
        </Section>

        <Section title="5. Customer refunds">
          Customers may receive a refund on unredeemed vouchers within the refund window shown at
          purchase. Because payouts only release on redemption, a pre-redemption refund never touches
          money you&rsquo;ve been paid. Where Gloē refunds a customer after you have been paid (for example
          a goodwill or post-redemption refund Gloē deems warranted), Gloē may recover your
          proportional share as described in section 6.
        </Section>

        <Section title="6. Chargebacks and disputes — liability">
          Chargeback liability for disputed transactions on your services sits with you. When a
          customer disputes a charge: (a) any unredeemed voucher on that transaction is immediately
          frozen and cannot be redeemed while the dispute is open; (b) any pending payout on that
          transaction is withheld until the dispute resolves. If the dispute is resolved in our favor,
          the voucher is unfrozen and the payout releases normally. If the dispute is lost, you bear
          the disputed amount and the card network&rsquo;s dispute fee: Gloē may reverse the related Stripe
          transfer, withhold or offset future payouts, or invoice you to recover those amounts. A
          transfer reversal can take your Stripe balance negative, in which case Stripe recoups it
          from your future sales. Gloē retains its platform fee on refunded and disputed
          transactions — the platform fee and dispute fees are not funded by Gloē.
        </Section>

        <Section title="7. Promotional credits">
          Credits that customers apply at checkout (referral rewards, promotions) are funded by Gloē.
          Your payout is always computed on the full deal price — a customer paying partly with
          credits never reduces your share.
        </Section>

        <Section title="8. Your content">
          You grant Gloē a license to display the business information, photos, and videos you upload,
          and your business&rsquo;s public review content, for operating and promoting the marketplace. You
          must have the rights to everything you upload.
        </Section>

        <Section title="9. Suspension and termination">
          Either party may end this agreement at any time; outstanding vouchers must still be honored
          or refunded. Gloē may pause or suspend your listings immediately for suspected fraud,
          license issues, customer-safety concerns, or repeated failure to honor vouchers. Sections 6
          (chargeback liability) and 8 survive termination for transactions that occurred before it.
        </Section>

        <Section title="10. Changes">
          We may update this agreement; material changes will be communicated to you, and continuing
          to list deals after the effective date constitutes acceptance of the updated version.
        </Section>

        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          This is a starting template and not legal advice. Replace with a counsel-reviewed agreement
          before launch.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
