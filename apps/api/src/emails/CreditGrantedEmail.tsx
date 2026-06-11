import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface CreditGrantedData {
  firstName: string | null;
  /** Credit amount in cents. */
  amountCents: number;
  /** Human expiry date (e.g. "September 8, 2026"), or null if it never expires. */
  expiresAt: string | null;
  /** Campaign message / admin note — the "why". Optional. */
  message?: string | null;
  /** Where the CTA lands (the consumer discover page). */
  browseUrl: string;
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Wallet credit landed (GLO-24) — campaign blasts + god-mode manual grants. */
export function CreditGrantedEmail(d: CreditGrantedData) {
  const hi = d.firstName ? `Good news, ${d.firstName}` : 'Good news';
  // Preheader adds info beyond the subject: amount + expiry + how it applies.
  const preview = `${money(d.amountCents)} in credit${d.expiresAt ? ` · use by ${d.expiresAt}` : ''} · applies automatically at checkout`;
  return (
    <BaseLayout preview={preview}>
      <Text style={h1}>{hi} — you&apos;ve got Gloē credit.</Text>

      <Section style={card}>
        <Text style={amount}>{money(d.amountCents)}</Text>
        <Text style={sub}>
          {d.expiresAt ? `Use it by ${d.expiresAt}.` : 'It never expires.'}
        </Text>
      </Section>

      {d.message ? <Text style={p}>{d.message}</Text> : null}

      <Text style={fine}>
        No codes, nothing to enter — your credit applies automatically at
        checkout and covers as much of your next booking as it can.
      </Text>

      <Button href={d.browseUrl} style={btn}>Find a treatment</Button>
    </BaseLayout>
  );
}

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1410', margin: '8px 0 16px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '16px 0 0' };
const card: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: '20px 16px', border: '1px solid #ece6db', textAlign: 'center' };
const amount: React.CSSProperties = { fontSize: 34, fontWeight: 700, color: '#b8806f', margin: 0 };
const sub: React.CSSProperties = { fontSize: 13, color: '#6b6358', margin: '4px 0 0' };
const fine: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '16px 0 16px' };
const btn: React.CSSProperties = { backgroundColor: '#b8806f', color: '#ffffff', fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '10px 20px', borderRadius: 999, display: 'inline-block' };
