import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="consumer-container" style={{ maxWidth: 760, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 34 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>Last updated: June 2, 2026</p>

      <div style={{ marginTop: 24, color: 'var(--text-secondary)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p>
          Welcome to Gloē. By using gloe.app or the Gloē app to discover and purchase beauty and wellness
          deals, you agree to these terms. Gloē is a marketplace that connects you with independent spas
          and providers; we are not the provider of the treatments themselves.
        </p>
        <Section title="Purchases & vouchers">
          When you buy a deal, we charge your payment method and issue a voucher (with a QR code) redeemable
          at the listed business. Vouchers expire on the date shown. Payment is processed securely by Stripe.
        </Section>
        <Section title="Refunds">
          Unredeemed vouchers are eligible for a hassle-free refund within 3 days of purchase. After a voucher
          is redeemed, or after it expires, it is non-refundable. Contact support for help with a refund.
        </Section>
        <Section title="The business relationship">
          The spa or provider is solely responsible for the services they deliver, including scheduling,
          quality, and safety. Gloē facilitates discovery and payment but does not perform treatments.
        </Section>
        <Section title="Acceptable use">
          Don’t misuse the platform, attempt to defraud businesses, or share vouchers in violation of their
          per-customer limits. Vouchers are tied to your account.
        </Section>
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>
          This is a starting template and not legal advice. Replace with counsel-reviewed terms before launch.
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
