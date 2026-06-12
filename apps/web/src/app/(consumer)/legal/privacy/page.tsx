import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

/**
 * Privacy Policy — counsel-depth draft written to CCPA/CPRA notice
 * requirements (GLO-15 tracks the licensed-attorney validation pass).
 *
 * Standing constraints:
 * - "No sale/share" + "no cross-context behavioral advertising" must stay true
 *   in code. Adding ANY ads/attribution SDK changes this policy AND the ATT
 *   posture (GLO-13) — both together, never one without the other.
 * - Every claim here is implementation-verified (Stripe-only card handling,
 *   deletion = scrub + tombstone, location optional, push tokens opt-in).
 */
export default function PrivacyPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 12, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          This policy explains what Gloē (&ldquo;we&rdquo;) collects about you, why, who receives it, how long
          we keep it, and the rights you have over it. It applies to gloe.app, the Gloē app, and our
          communications. The short version: we collect only what the marketplace needs, we do not
          sell or share your personal information for advertising, and we do not track you across
          other companies&rsquo; apps or websites.
        </p>

        <Section title="1. What we collect, and from where">
          <b>Identifiers</b> — name and email (from you, via our sign-in provider Clerk; if you sign
          in with Apple or Google, we receive the name/email those services release, which for Apple
          may be a private relay address), and phone number if you provide it. <b>Commercial
          information</b> — Deals you save, buy, gift, and redeem; Vouchers; Credits and referrals;
          refunds, disputes, and receipts (from your activity). <b>Geolocation</b> — approximate or
          precise location, only while you grant it, used to show nearby Deals and drive times (from
          your device). <b>Content</b> — reviews, photos, and support messages you submit.
          <b> Device and usage data</b> — push notification tokens (only if you enable
          notifications), IP address, and service logs needed for reliability, security, and fraud
          prevention (collected automatically). <b>What we never collect:</b> payment card numbers —
          cards go directly to Stripe and never touch Gloē&rsquo;s servers — and we collect no health or
          treatment records; what you discuss with a Provider stays with the Provider.
        </Section>

        <Section title="2. Why we use it">
          To operate the marketplace: show relevant nearby Deals; process purchases, payouts, and
          refunds; issue and redeem Vouchers; run Credits and referral rewards (including the fraud
          checks those programs need); send transactional email such as receipts, refund
          confirmations, and expiry reminders; deliver notifications you opt into; provide support;
          keep the Platform secure; comply with law; and improve the product using our own data. We
          do not use your information for third-party advertising, and we do not make decisions
          producing legal effects about you by solely automated means.
        </Section>

        <Section title="3. Who receives it">
          <b>Service providers under contract</b>, only what each needs: Stripe (payments, payouts,
          fraud prevention), Clerk (sign-in), Resend (transactional email), our cloud hosting and
          database providers, and Google (address autocomplete, maps). <b>The Provider you buy
          from</b> sees what it needs to honor your Voucher — your name and the Voucher/redemption
          details, never your payment information. <b>Legal</b> — we disclose information if
          required by law, to enforce our terms, or to protect safety. <b>Business transfers</b> —
          if Gloē is acquired or merges, your information transfers with the business, under this
          policy&rsquo;s commitments. <b>We do not sell your personal information and do not share it for
          cross-context behavioral advertising</b>, and we have not done either in the preceding 12
          months.
        </Section>

        <Section title="4. Your rights">
          Depending on your state (including under the California Consumer Privacy Act), you may
          have the right to <b>know/access</b> the personal information we hold about you, to
          <b> correct</b> it, to <b>delete</b> it, to <b>port</b> it, and to be free from
          <b> discrimination</b> for exercising these rights. Because we don&rsquo;t sell or share
          personal information, there is nothing to opt out of; if that ever changes we will update
          this policy and provide the required opt-out first, and we treat universal opt-out signals
          (such as Global Privacy Control) accordingly. <b>How to exercise:</b> delete your account
          yourself from the Account page (this deactivates it and scrubs your personal details), or
          email support@gloe.app for any other request. We will verify the request using your
          account email and respond within the time the law requires (45 days under the CCPA,
          extendable once). You may use an authorized agent where the law allows; we will still
          verify with you directly.
        </Section>

        <Section title="5. Your choices">
          Location, push notifications, and any marketing email are optional — control them in your
          device settings, the app, or the unsubscribe link. Transactional messages (receipts,
          refund and expiry notices) are part of the service. You can decline Apple/Google sign-in
          and use email + password instead.
        </Section>

        <Section title="6. Retention and security">
          We keep personal information while your account is active and as long as needed for the
          purposes above. When you delete your account, your personal details (name, email, phone,
          photo, saved city) are scrubbed and the account is deactivated; transaction records are
          retained in de-identified form tied to the deactivated account for as long as tax,
          accounting, and dispute rules require (typically 7 years), then deleted. We protect
          personal information with encryption in transit, access controls, and the safeguards of
          the processors above; no system is perfectly secure, and we will notify you and regulators
          of a breach as the law requires.
        </Section>

        <Section title="7. Children">
          Gloē is for adults (18+). We do not knowingly collect personal information from minors; if
          you believe a minor has an account, contact us and we will delete it.
        </Section>

        <Section title="8. Changes and contact">
          Material changes will be posted here with a new date and, for significant changes,
          notified by email or in-app. California residents may request the disclosures described
          above (&ldquo;right to know&rdquo;) twice in any 12-month period free of charge. Privacy questions and
          requests: support@gloe.app (subject &ldquo;Privacy&rdquo;), or in-app support.
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
