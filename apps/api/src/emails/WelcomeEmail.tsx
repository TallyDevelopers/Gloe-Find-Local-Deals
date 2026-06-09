import { Button, Hr, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface WelcomeData {
  firstName: string | null;
  /** Location-aware discover page (GLO-14 Universal Link once live). */
  discoverUrl: string;
}

/**
 * One-time welcome email on first signup (GLO-28). Fully static by design —
 * no listings, no prices; all freshness lives behind the CTA, which the
 * discover page self-adjusts by location. Premium/curated tone (locked spec):
 * the word "deals" never appears in headline or CTA.
 */
export function WelcomeEmail(d: WelcomeData) {
  const h1Text = d.firstName ? `Welcome to Gloē, ${d.firstName}.` : 'Welcome to Gloē.';
  return (
    <BaseLayout preview="Your city's best aesthetic treatments, all in one place.">
      <Text style={h1}>{h1Text}</Text>
      <Text style={p}>
        Your city&apos;s best aesthetic treatments, all in one place. We bring the spas worth
        visiting to you — so the only thing left to do is book.
      </Text>
      <Text style={early}>
        You&apos;re early — we&apos;re just getting started, and we&apos;re glad you&apos;re here.
      </Text>

      <Button href={d.discoverUrl} style={btn}>Explore treatments near you →</Button>

      <Hr style={divider} />
      <Text style={howTitle}>How it works</Text>
      <Section>
        <Text style={step}><span style={stepNum}>1</span> Find a treatment near you</Text>
        <Text style={step}><span style={stepNum}>2</span> Book &amp; pay in seconds</Text>
        <Text style={step}><span style={stepNum}>3</span> Show your voucher, glow</Text>
      </Section>
    </BaseLayout>
  );
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#1a1410', margin: '8px 0 4px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '0 0 12px' };
const early: React.CSSProperties = { fontSize: 14, fontStyle: 'italic', color: '#6b6358', lineHeight: 1.5, margin: '0 0 4px' };
const btn: React.CSSProperties = { backgroundColor: '#b8806f', color: '#ffffff', fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '12px 22px', borderRadius: 999, display: 'inline-block', margin: '16px 0 4px' };
const divider: React.CSSProperties = { borderColor: '#ece6db', margin: '20px 0 12px' };
const howTitle: React.CSSProperties = { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e8f', margin: '0 0 8px' };
const step: React.CSSProperties = { fontSize: 14, color: '#4a4339', lineHeight: 1.6, margin: '0 0 6px' };
const stepNum: React.CSSProperties = { display: 'inline-block', width: 20, fontWeight: 700, color: '#b8806f' };
