import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service' };

/**
 * Consumer Terms of Service — counsel-depth draft (GLO-15 tracks the licensed
 * attorney validation pass; this is not legal advice).
 *
 * Drafting constraints baked in — don't change these without re-checking law:
 * - §5 expiry follows CA Civil Code §1749.5 (Groupon rule): promotional value
 *   may expire, the amount PAID survives. Never revert to "expires worthless."
 * - §13 arbitration follows JAMS Consumer Minimum Standards: Gloē pays fees
 *   beyond a court-equivalent filing fee, hearing in customer's county or
 *   remote, 30-day opt-out, small-claims + IP carve-outs, severable class
 *   waiver, 60-day informal-resolution gate.
 * - Every operational promise here is verified against the codebase (3-day
 *   refund, split-tender refunds, credit clawback, voucher freeze on dispute,
 *   expiry reminders, account deletion). Don't add promises the product
 *   doesn't keep.
 */
export default function TermsPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 12, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you and Gloē
          (&ldquo;Gloē,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) governing your use of gloe.app, the Gloē mobile application, and
          the services available through them (together, the &ldquo;Platform&rdquo;). By creating an account,
          checking a consent box, or using the Platform, you accept these Terms.{' '}
          <strong>
            They include an arbitration agreement and class-action waiver (Section 13) that affect
            how disputes between you and Gloē are resolved — please read it.
          </strong>{' '}
          If you list services as a business, the <a href="/legal/vendor-terms">Vendor Agreement</a>{' '}
          also applies to you. Our <a href="/legal/privacy">Privacy Policy</a> explains how we handle
          your information.
        </p>

        <Section title="1. Definitions">
          &ldquo;<b>Provider</b>&rdquo; means an independent spa, med-spa, or licensed practitioner that lists
          services on the Platform. &ldquo;<b>Deal</b>&rdquo; means a Provider&rsquo;s offer listed on the Platform,
          including its price, options, restrictions, and fine print. &ldquo;<b>Voucher</b>&rdquo; means the
          redeemable credential (including a QR code) we issue to your account when a Deal is
          purchased. &ldquo;<b>Paid Value</b>&rdquo; means the amount actually paid for a Voucher;
          &ldquo;<b>Promotional Value</b>&rdquo; means any additional value beyond the Paid Value (the discount).
          &ldquo;<b>Credits</b>&rdquo; means promotional credits Gloē grants under Section 6.
        </Section>

        <Section title="2. What Gloē is — and is not">
          Gloē is a marketplace that connects you with independent Providers and facilitates
          discovery, payment, and Voucher redemption. <b>Gloē is not a medical provider, does not
          perform treatments, and does not employ or supervise Providers.</b> Providers are solely
          responsible for the services they deliver, including availability, scheduling,
          consultations, quality, hygiene, and safety, and for holding the licenses their services
          require. Gloē verifies Provider licensure documentation before Deals go live, but
          verification is not an endorsement, warranty, or guarantee of any Provider or outcome.
          Nothing on the Platform is medical advice. Aesthetic and wellness treatments carry
          inherent risks; whether a treatment is appropriate for you is a decision between you and
          the Provider, who may require a consultation and may decline service based on their
          professional judgment. You knowingly assume the risks inherent in services you choose to
          receive, to the extent permitted by law.
        </Section>

        <Section title="3. Eligibility and your account">
          You must be at least 18 years old (or the age of majority where you live, if higher) to
          use the Platform. You agree to provide accurate account information and keep your
          credentials confidential; activity under your account is your responsibility. Vouchers and
          Credits are associated with your account. You may delete your account at any time from the
          Account page, which deactivates it and removes your personal details as described in the
          Privacy Policy; deletion does not erase transaction records we must retain by law, and it
          does not entitle you to a refund of amounts not otherwise refundable under Section 5.
        </Section>

        <Section title="4. Purchases, Vouchers, and gift payments">
          When you buy a Deal, we (through our payment processor, Stripe) charge your payment method
          and issue a Voucher to your account, with an emailed receipt. Vouchers: (a) may be subject
          to per-customer and lifetime purchase limits stated on the Deal; (b) are non-transferable
          after issuance and may be redeemed only by your account through the Gloē redemption flow
          at the Provider; (c) remain subject to the Deal&rsquo;s stated restrictions (for example,
          new-customer-only terms); and (d) may not be resold. You may generate a payment link so
          another person can pay for your purchase; in that case the Voucher is still issued to your
          account, and the payer acquires no Voucher, account rights, or refund rights — the payer&rsquo;s
          sole relationship is with you. Prices may change at any time, but changes do not affect
          Vouchers already purchased. In the event of an obvious pricing error, we may cancel the
          purchase and refund you in full.
        </Section>

        <Section title="5. Refunds and expiration">
          <b>Refund window.</b> An unredeemed Voucher is eligible for a full refund, no questions
          asked, for 3 days after purchase — contact support or use the in-app option. After a
          Voucher is redeemed, it is non-refundable except where the law requires otherwise or we
          choose to make a goodwill exception. <b>Expiration.</b> Each Voucher shows an expiration
          date. After that date, the Promotional Value expires, but the Paid Value does not: contact
          support and we will, at your choice where the law permits, apply the Paid Value toward the
          same or another Deal, reissue the Voucher, or refund the Paid Value where required by
          applicable law. We send reminder emails before expiration as a courtesy; non-receipt of a
          reminder does not extend any date. <b>How refunds are returned.</b> Refunds return the way
          you paid: the cash portion to your original payment method and any Credits you applied
          back to your Credit balance. If a Provider permanently closes or cannot honor a valid,
          unexpired Voucher, contact us and we will refund the Paid Value or issue equivalent
          Credits.
        </Section>

        <Section title="6. Credits">
          Gloē may grant Credits — for example referral rewards or promotional campaigns. Unless
          their terms state otherwise, Credits: are funded by Gloē and are promotional; have no cash
          value and are not redeemable for cash or transferable; expire on the date shown in your
          wallet; and apply automatically at checkout unless you toggle them off. Referral rewards
          require that the referred person be a genuine new customer who completes a qualifying
          first purchase meeting the stated minimum; both sides&rsquo; rewards are subject to the
          program&rsquo;s stated caps and anti-abuse rules. Self-referrals, duplicate or fabricated
          accounts, and payment-method manipulation do not qualify, and we may reverse Credits
          obtained through them. If a purchase that earned Credits is refunded or disputed, the
          Credits it earned are reversed, which can make your Credit balance negative until offset
          by future Credits. We may modify or discontinue Credit programs prospectively; earned
          Credits remain usable until their stated expiration.
        </Section>

        <Section title="7. Chargebacks">
          If you initiate a chargeback, the Vouchers on the disputed purchase are frozen and cannot
          be redeemed while the dispute is open, and associated Credits may be reversed under
          Section 6. We encourage you to contact support before disputing a charge — our refund
          policy is faster than a bank dispute, and a chargeback on a purchase you in fact received
          may be treated as fraud. If a dispute resolves in our favor, frozen Vouchers are restored.
        </Section>

        <Section title="8. Reviews and your content">
          You may post reviews, photos, and other content. You represent that your content is
          honest, based on your genuine experience, and that you have all rights needed to post it.
          Do not post content that is unlawful, deceptive, harassing, infringing, or that identifies
          other customers or health information of any person without consent. You grant Gloē a
          non-exclusive, worldwide, royalty-free license to host, display, reproduce, and adapt (for
          formatting) your content in connection with operating and promoting the Platform; you can
          end this license for a given item by deleting it, except where it has been shared with
          others or retained as required by law. We may remove content that violates these Terms.
          We respond to copyright complaints under the DMCA: send notices identifying the work, the
          infringing material&rsquo;s location, your contact information, and the statements required by
          17 U.S.C. §512(c)(3) to support@gloe.app (subject line &ldquo;DMCA&rdquo;).
        </Section>

        <Section title="9. Acceptable use">
          You agree not to: misuse or interfere with the Platform; access it by automated means or
          scrape its content; circumvent purchase limits, redemption controls, or security measures;
          manipulate Credits, referrals, or reviews; impersonate others; use the Platform to defraud
          Providers or Gloē; or use it in violation of law. We may suspend or terminate accounts
          engaged in fraud or abuse, and freeze associated Vouchers and Credits pending
          investigation; legitimately purchased Paid Value will be refunded if we close your account
          without cause.
        </Section>

        <Section title="10. Intellectual property and third-party services">
          The Platform — including its software, design, text, and marks — belongs to Gloē or its
          licensors; these Terms grant you only a personal, revocable, non-transferable right to use
          it as intended. Payment processing is provided by Stripe and subject to Stripe&rsquo;s consumer
          terms; mapping and address services are provided by Google. We are not responsible for
          third-party services&rsquo; acts or omissions.
        </Section>

        <Section title="11. Disclaimers">
          THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE FULLEST EXTENT PERMITTED BY
          LAW, GLOĒ DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, AND ANY WARRANTY REGARDING SERVICES
          DELIVERED BY PROVIDERS. SOME JURISDICTIONS DO NOT ALLOW CERTAIN WARRANTY DISCLAIMERS, SO
          PARTS OF THIS SECTION MAY NOT APPLY TO YOU.
        </Section>

        <Section title="12. Limitation of liability and indemnification">
          TO THE FULLEST EXTENT PERMITTED BY LAW: (A) GLOĒ IS NOT LIABLE FOR SERVICES DELIVERED OR
          NOT DELIVERED BY PROVIDERS, OR FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR LOST PROFITS OR DATA; AND (B) GLOĒ&rsquo;S TOTAL LIABILITY FOR ALL CLAIMS
          RELATING TO A PURCHASE IS LIMITED TO THE AMOUNT YOU PAID FOR THAT PURCHASE, AND FOR ALL
          OTHER CLAIMS, TO ONE HUNDRED DOLLARS (US $100). NOTHING IN THESE TERMS LIMITS LIABILITY
          THAT CANNOT BE LIMITED BY LAW, INCLUDING LIABILITY FOR GROSS NEGLIGENCE, WILLFUL
          MISCONDUCT, OR FRAUD. You agree to indemnify and hold Gloē harmless from third-party
          claims arising out of your violation of these Terms, your misuse of the Platform, or
          content you post, except to the extent caused by Gloē&rsquo;s own negligence or misconduct.
          Claims arising from a Provider&rsquo;s services are between you and that Provider.
        </Section>

        <Section title="13. Dispute resolution: arbitration and class-action waiver">
          <b>Please read this section carefully — it affects your rights.</b> <b>(a) Informal
          resolution first.</b> Before filing any claim, you and Gloē each agree to send the other a
          written description of the dispute (to support@gloe.app, subject &ldquo;Legal Notice,&rdquo; or to
          your account email) and to try in good faith to resolve it within 60 days. <b>(b)
          Arbitration.</b> If we cannot, any dispute arising out of these Terms or the Platform will
          be resolved by binding individual arbitration administered by JAMS under its Streamlined
          Rules and Consumer Minimum Standards, rather than in court. The arbitration will be held
          in the county where you live or remotely by video, at your choice. Gloē will pay all JAMS
          fees beyond the equivalent of your local court filing fee. The arbitrator may award the
          same individual relief a court could. <b>(c) Carve-outs.</b> Either party may bring an
          individual claim in small-claims court, and either party may seek injunctive relief in
          court for infringement or misuse of intellectual property or for unauthorized access to
          the Platform. <b>(d) Class waiver.</b> You and Gloē each waive the right to a jury trial
          and to participate in a class, collective, or representative action, to the extent
          permitted by law. If the class waiver is found unenforceable as to a particular claim,
          that claim (and only that claim) proceeds in court. <b>(e) Opt-out.</b> You may opt out of
          this arbitration agreement entirely by emailing support@gloe.app with the subject
          &ldquo;Arbitration Opt-Out&rdquo; from your account email within 30 days of first accepting these
          Terms; opting out does not affect any other provision. <b>(f)</b> Disputes with a Provider
          about their services are between you and the Provider and are not subject to this
          section.
        </Section>

        <Section title="14. General">
          These Terms are governed by the laws of the State of California, without regard to its
          conflict-of-laws rules, except that the Federal Arbitration Act governs Section 13. If any
          provision is found unenforceable, the remainder stays in effect. These Terms (with the
          policies they reference) are the entire agreement between you and Gloē regarding the
          Platform and supersede prior discussions. Our failure to enforce a provision is not a
          waiver. You may not assign these Terms or your account; Gloē may assign them in connection
          with a merger, acquisition, or sale of assets, with notice to you. We may update these
          Terms; material changes will be posted here with a new date (and, for significant changes,
          notified by email or in-app), and continued use after the effective date is acceptance. If
          you do not agree to a change, stop using the Platform and contact support about any
          unredeemed Paid Value. Questions and support: in-app, or support@gloe.app.
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
