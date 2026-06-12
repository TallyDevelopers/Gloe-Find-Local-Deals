import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

/**
 * Privacy Policy, written to CCPA/CPRA notice requirements (categories,
 * purposes, rights, no sale/share). Pending counsel review under GLO-15.
 * If we ever add ads/attribution SDKs or cross-context sharing, the
 * "no sale/share" statement and the ATT posture (GLO-13) both change.
 */
export default function PrivacyPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 12, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          Gloē respects your privacy. This policy explains what we collect, why, who we share it
          with, and the rights you have over it. The short version: we collect only what we need to
          run the marketplace, we don&rsquo;t sell or share your personal information for advertising,
          and we don&rsquo;t track you across other companies&rsquo; apps or websites.
        </p>

        <Section title="What we collect">
          <b>Identifiers</b> — name and email via our sign-in provider (Clerk), and phone number if
          you provide it. <b>Commercial information</b> — the deals you save, buy, and redeem;
          vouchers; credits and referrals; refunds and receipts. <b>Approximate or precise
          location</b> — only when you grant it, to show nearby deals and drive times. <b>Content
          you post</b> — reviews, photos, and support messages. <b>Device and usage data</b> — push
          notification tokens (if you enable notifications) and basic logs needed to keep the
          service reliable and prevent fraud. We do not collect payment card numbers — cards are
          handled directly by Stripe and never touch Gloē&rsquo;s servers.
        </Section>

        <Section title="How we use it">
          To show relevant nearby deals, process purchases and refunds, deliver and redeem vouchers,
          run credits and referral rewards (including fraud checks), send transactional email
          (receipts, refund confirmations, expiry reminders) and the notifications you opt into,
          provide support, and improve the product. We use your information only for running Gloē —
          not for third-party advertising.
        </Section>

        <Section title="Who we share it with">
          Service providers that run parts of the platform under contract: <b>Stripe</b> (payments
          and payouts), <b>Clerk</b> (sign-in), <b>Resend</b> (transactional email), our hosting and
          database providers, and <b>Google</b> (address autocomplete and maps). The business you
          buy from sees what it needs to honor your voucher — your name and the voucher details, not
          your payment information. We disclose information if the law requires it. We do not sell
          your personal information, and we do not share it for cross-context behavioral
          advertising.
        </Section>

        <Section title="Your rights">
          Depending on where you live (including under the California Consumer Privacy Act), you
          have the right to know what personal information we hold about you, to correct it, to
          delete it, and to not be discriminated against for exercising those rights. You can delete
          your account yourself from the Account page — this deactivates the account and scrubs your
          personal details from it. For any other request, email support@gloe.app and we&rsquo;ll respond
          within the time the law requires. We don&rsquo;t sell or share personal information, so there is
          nothing to opt out of — but if that ever changes, we&rsquo;ll update this policy and provide the
          required opt-out first.
        </Section>

        <Section title="Your choices">
          Location access, push notifications, and marketing email are all optional and can be
          turned off anytime in your device settings or the app. Transactional email (like receipts)
          is part of the service.
        </Section>

        <Section title="Retention">
          We keep your information while your account is active. When you delete your account, your
          personal details are scrubbed from it; transaction records are retained in anonymized form
          as long as tax, accounting, and dispute rules require.
        </Section>

        <Section title="Children">
          Gloē is for adults. We don&rsquo;t knowingly collect personal information from anyone under 18;
          if you believe a minor has an account, contact us and we&rsquo;ll delete it.
        </Section>

        <Section title="Changes & contact">
          Material changes to this policy will be posted here with a new date. Questions or privacy
          requests: support@gloe.app.
        </Section>

        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          This is a starting template and not legal advice. Replace with a counsel-reviewed policy
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
