import {
  Body, Container, Head, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components';
import * as React from 'react';

/**
 * Shared branded shell for every Gloē transactional email. Keeps logo, colors,
 * and footer in one place so receipts / refunds / payout notices all match.
 * Inline styles only — email clients ignore <style>/external CSS.
 */
export function BaseLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ padding: '28px 32px 8px' }}>
            <Text style={wordmark}>Gloē</Text>
          </Section>
          <Section style={{ padding: '0 32px' }}>{children}</Section>
          <Hr style={hr} />
          <Section style={{ padding: '0 32px 28px' }}>
            <Text style={footer}>
              Questions? Just reply to this email — it reaches a real person at{' '}
              <Link href="mailto:support@gloe.app" style={footerLink}>support@gloe.app</Link>.
            </Text>
            <Text style={footerFine}>Gloē · Beauty + wellness, beautifully booked.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = { backgroundColor: '#f5f2ec', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: '24px 0' };
const container: React.CSSProperties = { backgroundColor: '#ffffff', borderRadius: 14, maxWidth: 480, margin: '0 auto', overflow: 'hidden', border: '1px solid #ece6db' };
const wordmark: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: '#b8806f', letterSpacing: '0.06em', margin: 0 };
const hr: React.CSSProperties = { borderColor: '#ece6db', margin: '24px 0 0' };
const footer: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '16px 0 8px' };
const footerLink: React.CSSProperties = { color: '#b8806f', textDecoration: 'none' };
const footerFine: React.CSSProperties = { fontSize: 11, color: '#a89e8f', margin: 0 };
