import { Body, Head, Html, Link, Preview, Text } from '@react-email/components';
import * as React from 'react';

export interface WelcomeData {
  firstName: string | null;
  /** Location-aware discover page (GLO-14 Universal Link once live). */
  discoverUrl: string;
}

/**
 * One-time welcome email on first signup (GLO-28). Deliberately a plain
 * personal founder note — NO branded shell, button, or card layout. Those are
 * exactly the signals Gmail's classifier uses to file mail under Promotions;
 * a plain-text-shaped note from a person lands in Primary. Don't "improve"
 * this with BaseLayout or a styled CTA — that's the whole point.
 *
 * Still static (no listings/prices) and premium-toned per the locked spec;
 * the word "deals" never appears.
 */
export function WelcomeEmail(d: WelcomeData) {
  const hi = d.firstName ? `Hi ${d.firstName},` : 'Hi,';
  return (
    <Html>
      <Head />
      <Preview>Your city&apos;s best aesthetic treatments, all in one place.</Preview>
      <Body style={body}>
        <Text style={p}>{hi}</Text>
        <Text style={p}>
          Welcome to Gloē — and thanks for signing up.
        </Text>
        <Text style={p}>
          The short version of what we do: your city&apos;s best aesthetic treatments, all in one
          place. We bring the spas worth visiting to you, so the only thing left to do is book —
          find a treatment near you, book and pay in seconds, then show your voucher and glow.
        </Text>
        <Text style={p}>
          You&apos;re early — we&apos;re just getting started, and we&apos;re glad you&apos;re here.
          Take a look at what&apos;s near you:{' '}
          <Link href={d.discoverUrl} style={link}>{d.discoverUrl.replace(/^https?:\/\//, '')}</Link>
        </Text>
        <Text style={p}>
          And if anything&apos;s confusing or broken, just reply to this email — it comes straight
          to me.
        </Text>
        <Text style={p}>
          — Ryan, founder of Gloē
        </Text>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", margin: 0, padding: '24px', maxWidth: 560 };
const p: React.CSSProperties = { fontSize: 15, color: '#1a1410', lineHeight: 1.6, margin: '0 0 16px' };
const link: React.CSSProperties = { color: '#b8806f', textDecoration: 'underline' };
