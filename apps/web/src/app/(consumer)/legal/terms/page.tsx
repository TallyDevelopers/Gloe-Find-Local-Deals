import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service' };

/**
 * Consumer Terms of Service. Pending counsel review under GLO-15. The vendor
 * side lives at /legal/vendor-terms (GLO-35).
 */
export default function TermsPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 11, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          Welcome to Gloē. By using gloe.app or the Gloē app to discover and purchase beauty and
          wellness deals, you agree to these terms. If you list services as a business, the{' '}
          <a href="/legal/vendor-terms">Vendor Agreement</a> also applies to you.
        </p>

        <Section title="1. What Gloē is (and isn't)">
          Gloē is a marketplace that connects you with independent spas and licensed providers. The
          businesses on Gloē — not Gloē — deliver the treatments, set their availability, and are
          solely responsible for the services they provide, including scheduling, quality, and
          safety. Nothing on Gloē is medical advice; consult the provider about whether a treatment
          is right for you.
        </Section>

        <Section title="2. Your account">
          You must be an adult (the age of majority where you live) to buy on Gloē. Keep your account
          credentials to yourself — vouchers and credits are tied to your account. You can delete
          your account anytime from the Account page.
        </Section>

        <Section title="3. Purchases & vouchers">
          When you buy a deal, we charge your payment method and issue a voucher (with a QR code)
          redeemable at the listed business. Vouchers expire on the date shown — we&rsquo;ll remind you
          before they do. Deals may carry per-customer limits; vouchers are non-transferable and
          redeemable only through the Gloē redemption flow at the business. Payment is processed
          securely by Stripe; we email you a receipt for every purchase.
        </Section>

        <Section title="4. Refunds">
          Unredeemed vouchers are eligible for a hassle-free refund within 3 days of purchase. After
          a voucher is redeemed, or after it expires, it is non-refundable — though our support team
          can help in exceptional cases. Refunds return the way you paid: the cash portion back to
          your payment method, and any credits you applied back to your credit balance.
        </Section>

        <Section title="5. Credits">
          Gloē may grant promotional credits (for example referral rewards or promotions). Credits
          are funded by Gloē, have no cash value, are not transferable or redeemable for cash, and
          expire on the date shown in your wallet. Credits apply automatically at checkout unless you
          toggle them off. If a purchase that earned you credits is refunded or disputed, the credits
          it earned are reversed — which can make your credit balance negative until it&rsquo;s repaid by
          future credits. Referral rewards require the referred friend&rsquo;s qualifying first purchase
          and are subject to anti-abuse limits; self-referrals and duplicate accounts don&rsquo;t qualify.
        </Section>

        <Section title="6. Chargebacks">
          If you dispute a charge with your bank, the vouchers on that purchase are frozen and cannot
          be redeemed while the dispute is open. Please contact support first — most issues are
          faster to resolve directly, and our refund policy is genuinely hassle-free.
        </Section>

        <Section title="7. Reviews & content">
          You may post reviews and photos of your experience. Post only honest content you have the
          rights to; no spam, harassment, or content that identifies other customers without their
          consent. You grant Gloē a license to display the content you post on the marketplace.
        </Section>

        <Section title="8. Acceptable use">
          Don&rsquo;t misuse the platform, attempt to defraud businesses, manipulate credits or referrals,
          scrape the service, or share vouchers in violation of their per-customer limits. We may
          suspend accounts engaged in fraud or abuse.
        </Section>

        <Section title="9. Disclaimers & liability">
          Gloē provides the marketplace &ldquo;as is.&rdquo; To the fullest extent the law allows, Gloē is not
          liable for the services businesses deliver, and our total liability for any claim related
          to a purchase is limited to the amount you paid Gloē for that purchase. Nothing in these
          terms limits liability that cannot be limited by law.
        </Section>

        <Section title="10. Changes & contact">
          We may update these terms; material changes will be posted here with a new date. These
          terms are governed by the laws of the State of California. Questions or refund help:
          contact support from the app or at support@gloe.app.
        </Section>

        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          This is a starting template and not legal advice. Replace with counsel-reviewed terms
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
