import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 2, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          Gloē respects your privacy. This policy explains what we collect and why. We collect only what we
          need to run the marketplace: your account details, the deals you save and buy, and your location
          (only when you grant it) so we can show nearby deals and drive times.
        </p>
        <Section title="What we collect">
          Account info (name, email) via our auth provider Clerk; purchase history and vouchers; approximate
          location when you choose to share it; and basic device/usage data to keep the service reliable.
        </Section>
        <Section title="How we use it">
          To show relevant nearby deals, process payments (via Stripe), deliver and redeem your vouchers,
          provide support, and improve the product. We don’t sell your personal data.
        </Section>
        <Section title="Payments">
          Card details are handled directly by Stripe and never stored on Gloē’s servers.
        </Section>
        <Section title="Your choices">
          You can revoke location access anytime in your browser, and delete your account from the Account
          page — which anonymizes and deactivates your data.
        </Section>
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          This is a starting template and not legal advice. Replace with a counsel-reviewed policy before launch.
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
