import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Vendor Agreement' };

/**
 * The Gloē Vendor Agreement — counsel-depth draft (GLO-35 shipped it; GLO-15
 * tracks the licensed-attorney validation pass; this is not legal advice).
 *
 * Vendors accept at signup (required checkbox, enforced server-side; stamped
 * vendors.terms_accepted_at + terms_version). Bump VENDOR_TERMS_VERSION in
 * apps/api/src/domain/vendorSignup.ts whenever this materially changes.
 *
 * §7 (chargebacks) is the contractual backing for the GLO-34 auto-clawback —
 * reverse transfers, offset future payouts, invoice. Don't soften it without
 * re-checking that flow.
 */
export default function VendorTermsPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Vendor Agreement</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 12, 2026 · Version 2026-06-12.2</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          This Vendor Agreement (&ldquo;Agreement&rdquo;) is between Gloē (&ldquo;Gloē,&rdquo; &ldquo;we&rdquo;) and the business
          identified at signup (&ldquo;Vendor,&rdquo; &ldquo;you&rdquo;). By checking the acceptance box at signup, by
          claiming a Vendor profile, or by listing a Deal, you accept this Agreement on behalf of
          the business and represent that you are authorized to bind it. The consumer{' '}
          <a href="/legal/terms">Terms of Service</a> govern customers&rsquo; use of the marketplace;
          capitalized terms not defined here (Deal, Voucher, Paid Value, Credits) have the meanings
          given there.
        </p>

        <Section title="1. Relationship of the parties">
          Gloē operates a marketplace that connects customers with independent businesses and
          facilitates discovery, payment collection, and Voucher redemption. <b>You — not Gloē — are
          the merchant of record and the provider of the services you sell.</b> You are an
          independent business; this Agreement creates no employment, agency, joint venture, or
          franchise relationship. You are solely responsible for delivering your services, including
          scheduling, consultations, staffing, supervision, quality, hygiene, safety, equipment, and
          premises. Gloē may collect payment from customers on your behalf as a limited payments
          facilitator through Stripe; receipt of a customer&rsquo;s payment by Gloē/Stripe discharges the
          customer&rsquo;s payment obligation to you for that purchase.
        </Section>

        <Section title="2. Eligibility, licensure, and compliance">
          You represent and warrant, on signup and continuously: (a) you hold, and each practitioner
          performing listed services holds, every license, permit, registration, and insurance
          required by applicable law for the services you list; (b) your services, advertising, and
          fine print comply with applicable law, including health-profession, consumer-protection,
          and advertising rules; and (c) the information in your profile and Deals is accurate and
          not misleading. Gloē reviews licensure documentation before Deals go live and may
          re-verify at any time; verification is for Gloē&rsquo;s benefit and is not a representation to
          you or to customers. You must notify us promptly (and in any case within 3 business days)
          if any required license lapses, is suspended, restricted, or revoked, or if an insurer or
          regulator takes action that affects your listed services. Misrepresenting licensure is
          grounds for immediate termination.
        </Section>

        <Section title="3. Deals and Vouchers">
          You set each Deal&rsquo;s content: price, options, quantity and per-customer limits, expiration
          window, and fine print. Deals go live only after Gloē&rsquo;s review and approval; editing a
          live Deal returns it to review. You agree to: (a) honor every valid, unexpired Voucher at
          the advertised terms, without surcharges or conditions beyond the Deal&rsquo;s stated fine
          print; (b) redeem Vouchers only through the Gloē redemption flow (the redemption scan is
          the event that releases your payout); (c) treat Voucher holders no less favorably than
          your other customers; and (d) after a Voucher&rsquo;s expiration, honor its Paid Value as
          required by applicable gift-certificate and consumer-protection law. If you permanently
          close or are unable to honor outstanding Vouchers, you must notify us promptly; Gloē may
          refund affected customers and recover those amounts under Section 7&rsquo;s recovery mechanics.
        </Section>

        <Section title="4. Fees, payment, and taxes">
          Gloē charges a platform fee per transaction. Your estimated earnings under the fee
          schedule in effect are shown to you as you price a Deal, and the exact fee applied is
          snapshotted on each sale — a later fee-schedule change never affects a sale already made.
          Fee-schedule changes apply prospectively and will be visible at Deal creation. Payouts of
          your share (sale price minus the platform fee) are made through Stripe Connect after a
          Voucher is redeemed; you must enter into and remain in good standing under the Stripe
          Connected Account Agreement, and you authorize Gloē to initiate transfers and transfer
          reversals on your connected account consistent with this Agreement. You are responsible
          for your own taxes, including sales and use taxes on your services and income taxes on
          your earnings; Stripe or Gloē may issue tax information returns (for example Form 1099-K)
          where required. Customer payments of Paid Value with Credits applied are funded by Gloē —
          your payout is always computed on the full Deal price.
        </Section>

        <Section title="5. Customer refunds">
          Customers may obtain a refund of unredeemed Vouchers within the refund window stated in
          the consumer Terms (currently 3 days after purchase). Because payouts release only on
          redemption, a pre-redemption refund never touches money you have been paid. If Gloē
          refunds a customer after you have been paid — for example a goodwill refund, a refund
          required by law, or a closure under Section 3 — Gloē may recover your share of that
          transaction using the recovery mechanics in Section 7. Gloē retains its platform fee on
          refunded transactions.
        </Section>

        <Section title="6. Customer data">
          You receive customer information (name, Voucher details, redemption status) solely to
          honor Vouchers and provide the purchased services. You may not use it for marketing
          outside the Platform without the customer&rsquo;s separate, lawful consent, sell it, or disclose
          it except as required to deliver the service or by law, and you must protect it with
          reasonable safeguards and comply with applicable privacy laws. Health information you
          collect in your practice is your responsibility as the provider of record.
        </Section>

        <Section title="7. Chargebacks and disputes — liability and recovery">
          <b>Liability for chargebacks on your services sits with you.</b> When a customer disputes
          a charge: (a) unredeemed Vouchers on the transaction are frozen and cannot be redeemed
          while the dispute is open; (b) any unreleased payout for the transaction is withheld until
          resolution; and (c) Gloē will respond to the dispute with available evidence, and you
          agree to provide promptly any records we request (redemption records, communications,
          service documentation). If the dispute resolves in our favor, Vouchers unfreeze and
          payouts release normally. <b>If the dispute is lost, you bear the disputed amount and the
          card network&rsquo;s dispute fee.</b> Gloē may recover those amounts by any combination of:
          reversing the related Stripe transfer (which may take your Stripe balance negative, in
          which case Stripe recoups from your future sales under your Stripe agreement); withholding
          or offsetting against your future payouts; or invoicing you, with payment due within 30
          days. Gloē retains its platform fee on disputed transactions, and Gloē does not fund
          dispute fees. Where a dispute reflects Gloē&rsquo;s own error (for example a duplicate charge of
          our making), this section does not apply and Gloē bears it.
        </Section>

        <Section title="8. Your content and marks">
          You grant Gloē a non-exclusive, worldwide, royalty-free license to host, display,
          reproduce, and adapt (for formatting) the content you provide — business information,
          photos, videos, and Deal copy — and to use your name, logo, and marks, in each case to
          operate, market, and promote the Platform and your listings during the term. You represent
          you have all rights needed to grant this license, including releases for any identifiable
          people in your media. Customer reviews of your business are Platform content; we do not
          remove reviews because they are negative, only because they violate our content rules.
        </Section>

        <Section title="9. Indemnification">
          You will defend, indemnify, and hold harmless Gloē and its officers, directors, employees,
          and agents from and against claims, damages, penalties, and expenses (including reasonable
          attorneys&rsquo; fees) arising out of: the services you provide or fail to provide (including
          personal injury); your content; your violation of law, licensure, or privacy obligations;
          your taxes; or your breach of this Agreement — except to the extent caused by Gloē&rsquo;s own
          negligence or willful misconduct. Gloē will defend, indemnify, and hold you harmless from
          third-party claims that the Platform itself (excluding your content and services)
          infringes intellectual-property rights. The indemnified party must give prompt notice and
          reasonable cooperation; the indemnifying party controls the defense but may not settle in
          a way that admits the other party&rsquo;s fault without consent.
        </Section>

        <Section title="10. Disclaimers and limitation of liability">
          THE PLATFORM IS PROVIDED &ldquo;AS IS.&rdquo; GLOĒ DOES NOT GUARANTEE ANY VOLUME OF SALES, CUSTOMERS,
          OR RESULTS. TO THE FULLEST EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE TO THE OTHER
          FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES OR LOST PROFITS, AND
          GLOĒ&rsquo;S TOTAL LIABILITY UNDER THIS AGREEMENT IS LIMITED TO THE PLATFORM FEES GLOĒ EARNED
          FROM YOUR TRANSACTIONS IN THE 12 MONTHS BEFORE THE CLAIM AROSE. THESE LIMITS DO NOT APPLY
          TO YOUR INDEMNIFICATION OBLIGATIONS, YOUR CHARGEBACK LIABILITY UNDER SECTION 7, EITHER
          PARTY&rsquo;S GROSS NEGLIGENCE, WILLFUL MISCONDUCT, OR FRAUD, OR LIABILITY THAT CANNOT BE
          LIMITED BY LAW.
        </Section>

        <Section title="11. Term, suspension, and termination">
          This Agreement runs from your acceptance until terminated. Either party may terminate at
          any time with notice (you: by closing your Vendor account; Gloē: by written notice). Gloē
          may suspend your listings or account immediately for suspected fraud, licensure issues,
          customer-safety concerns, repeated failure to honor Vouchers, or material breach. On
          termination: outstanding valid Vouchers must still be honored through their expiration or
          refunded under Section 5; amounts you owe become immediately recoverable under Section 7&rsquo;s
          mechanics; and earned, unreleased payouts for properly redeemed Vouchers will be released
          in the ordinary course, subject to open disputes. Sections 6 through 10, this section, and
          Section 12 survive termination.
        </Section>

        <Section title="12. Dispute resolution and general">
          Any dispute between you and Gloē arising out of this Agreement will be resolved by binding
          individual arbitration administered by JAMS in San Diego County, California under its
          Comprehensive Rules, except either party may bring an individual claim in small-claims
          court or seek injunctive relief in court for intellectual-property misuse or unauthorized
          Platform access; each party waives jury trial and class participation to the extent
          permitted by law. This Agreement is governed by California law (the Federal Arbitration
          Act governs this arbitration clause). If any provision is unenforceable, the remainder
          stays in effect. This Agreement (with the policies it references and your Deal listings)
          is the entire agreement between you and Gloē regarding the marketplace. You may not assign
          it without Gloē&rsquo;s consent (not to be unreasonably withheld for a sale of your business);
          Gloē may assign it in connection with a merger, acquisition, or sale of assets. We may
          update this Agreement; material changes will be communicated to you with at least 15 days&rsquo;
          notice, and continuing to list Deals after the effective date is acceptance — if you do
          not agree, your remedy is to stop listing and terminate. Notices to Gloē: support@gloe.app
          (subject &ldquo;Legal Notice&rdquo;); notices to you: your account email.
        </Section>
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
