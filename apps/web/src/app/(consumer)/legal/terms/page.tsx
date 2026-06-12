import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service' };

/**
 * Consumer Terms of Service. Pending counsel review under GLO-15. The vendor
 * side lives at /legal/vendor-terms (GLO-35).
 *
 * Expiry language (§4) is written to follow CA Civil Code §1749.5 (the
 * Groupon rule): the promotional value can expire, the amount paid cannot —
 * don't tighten it without counsel.
 */
export default function TermsPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 12, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          Welcome to Gloē. By creating an account or using gloe.app or the Gloē app to discover and
          purchase beauty and wellness deals, you agree to these terms, including the arbitration
          agreement in section 11. If you list services as a business, the{' '}
          <a href="/legal/vendor-terms">Vendor Agreement</a> also applies to you.
        </p>

        <Section title="1. What Gloē is (and isn't)">
          Gloē is a marketplace that connects you with independent spas and licensed providers. The
          businesses on Gloē — not Gloē — deliver the treatments, set their availability, and are
          solely responsible for the services they provide, including scheduling, quality, and
          safety. Nothing on Gloē is medical advice. Aesthetic treatments carry inherent risks;
          whether a treatment is appropriate for you is a decision between you and the provider, and
          providers may require a consultation before performing a service. You assume the risks
          inherent in the services you choose to receive.
        </Section>

        <Section title="2. Your account">
          You must be an adult (the age of majority where you live) to buy on Gloē. Keep your account
          credentials to yourself — vouchers and credits are tied to your account. You can delete
          your account anytime from the Account page.
        </Section>

        <Section title="3. Purchases & vouchers">
          When you buy a deal, we charge your payment method and issue a voucher (with a QR code)
          redeemable at the listed business. You can also share a payment link so someone else can
          pay for your purchase — the voucher is still issued to your account, and the payer
          receives no voucher or other rights. Deals may carry per-customer limits; vouchers are
          non-transferable after issuance and redeemable only through the Gloē redemption flow at
          the business. Payment is processed securely by Stripe; we email you a receipt for every
          purchase.
        </Section>

        <Section title="4. Refunds & expiration">
          Unredeemed vouchers are eligible for a hassle-free refund within 3 days of purchase — no
          questions asked. After a voucher is redeemed it is non-refundable. Each voucher shows a
          promotional expiration date: after that date the promotional value (any discount beyond
          what you paid) expires, but the amount you actually paid does not — contact support and
          we&rsquo;ll apply what you paid, reissue the voucher, or refund it, whatever the law of your
          state requires or our goodwill allows. We&rsquo;ll remind you by email before a voucher
          expires. Refunds return the way you paid: the cash portion to your payment method, and any
          credits you applied back to your credit balance.
        </Section>

        <Section title="5. Credits">
          Gloē may grant promotional credits (for example referral rewards or promotions). Credits
          are promotional, funded by Gloē, have no cash value, are not transferable or redeemable
          for cash, and expire on the date shown in your wallet. Credits apply automatically at
          checkout unless you toggle them off. If a purchase that earned you credits is refunded or
          disputed, the credits it earned are reversed — which can make your credit balance negative
          until it&rsquo;s repaid by future credits. Referral rewards require the referred friend&rsquo;s
          qualifying first purchase and are subject to anti-abuse limits; self-referrals and
          duplicate accounts don&rsquo;t qualify.
        </Section>

        <Section title="6. Chargebacks">
          If you dispute a charge with your bank, the vouchers on that purchase are frozen and cannot
          be redeemed while the dispute is open. Please contact support first — most issues are
          faster to resolve directly, and our refund policy is genuinely hassle-free.
        </Section>

        <Section title="7. Reviews & content">
          You may post reviews and photos of your experience. Post only honest content you have the
          rights to; no spam, harassment, or content that identifies other customers without their
          consent. You grant Gloē a license to display the content you post on the marketplace. To
          report content that infringes your copyright, email support@gloe.app with the work, the
          location of the infringing material, and your contact information.
        </Section>

        <Section title="8. Acceptable use">
          Don&rsquo;t misuse the platform, attempt to defraud businesses, manipulate credits or referrals,
          scrape the service, or share vouchers in violation of their per-customer limits. We may
          suspend accounts engaged in fraud or abuse.
        </Section>

        <Section title="9. Disclaimers & liability">
          Gloē provides the marketplace &ldquo;as is.&rdquo; To the fullest extent the law allows: Gloē
          disclaims all warranties, express or implied; Gloē is not liable for the services
          businesses deliver or for indirect, incidental, or consequential damages; and our total
          liability for any claim related to a purchase is limited to the amount you paid Gloē for
          that purchase. Nothing in these terms limits liability that cannot be limited by law.
        </Section>

        <Section title="10. Indemnification">
          You agree to indemnify and hold Gloē harmless from claims arising out of your misuse of
          the platform, your violation of these terms, or content you post — except to the extent
          caused by Gloē&rsquo;s own negligence or misconduct.
        </Section>

        <Section title="11. Arbitration & class-action waiver">
          Please read this carefully. Any dispute between you and Gloē arising out of these terms or
          the platform will be resolved by binding individual arbitration administered by JAMS in
          San Diego County, California, under its consumer rules, and not in court — except that
          either party may bring an individual claim in small-claims court, and you may opt out of
          this arbitration agreement by emailing support@gloe.app within 30 days of first accepting
          these terms. You and Gloē each waive the right to a jury trial and to participate in a
          class action. Claims against the business that performed your service are between you and
          that business and are not covered by this section.
        </Section>

        <Section title="12. General">
          These terms are governed by the laws of the State of California. If any provision is found
          unenforceable, the rest remain in effect. These terms are the entire agreement between you
          and Gloē about the platform; we may update them, and material changes will be posted here
          with a new date — continued use after the effective date is acceptance. You may not assign
          your account or these terms; Gloē may assign them in connection with a merger or sale.
          Questions or refund help: contact support from the app or at support@gloe.app.
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
