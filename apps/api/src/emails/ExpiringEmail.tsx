import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface ExpiringData {
  firstName: string | null;
  dealTitle: string;
  vendorName: string;
  code: string;
  /** Human expiry date, e.g. "August 7, 2026". */
  expiresAt: string;
  /** Days remaining until expiry (for the urgency line). */
  daysLeft: number;
  /** Web wallet link for the QR. */
  walletUrl: string;
}

/** Reminder that an unredeemed voucher is about to expire. */
export function ExpiringEmail(d: ExpiringData) {
  const hi = d.firstName ? `${d.firstName}, don't lose this!` : "Don't lose this!";
  const when = d.daysLeft <= 1 ? 'tomorrow' : `in ${d.daysLeft} days`;
  return (
    <BaseLayout preview={`Expires ${when} (${d.expiresAt}) — code ${d.code} at ${d.vendorName}.`}>
      <Text style={h1}>{hi}</Text>
      <Text style={p}>
        Your voucher for <strong>{d.dealTitle}</strong> at {d.vendorName} expires <strong>{when}</strong> ({d.expiresAt}).
        Book your visit before it&apos;s gone.
      </Text>

      <Section style={card}>
        <Text style={dealName}>{d.dealTitle}</Text>
        <Text style={sub}>{d.vendorName}</Text>
        <Text style={label}>Your voucher code</Text>
        <Text style={code}>{d.code}</Text>
      </Section>

      <Button href={d.walletUrl} style={btn}>View my wallet</Button>
      <Text style={fine}>
        Show this code (or your in-app QR) at {d.vendorName}. On your phone, open the Gloē app and tap the Wallet tab.
      </Text>
    </BaseLayout>
  );
}

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1410', margin: '8px 0 4px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '0 0 16px' };
const card: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: 16, border: '1px solid #ece6db' };
const dealName: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#1a1410', margin: 0 };
const sub: React.CSSProperties = { fontSize: 13, color: '#6b6358', margin: '2px 0 0' };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e8f', margin: '14px 0 4px' };
const code: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: '#b8806f', fontFamily: 'monospace', margin: 0 };
const btn: React.CSSProperties = { backgroundColor: '#b8806f', color: '#ffffff', fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '10px 20px', borderRadius: 999, display: 'inline-block', margin: '16px 0 0' };
const fine: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '12px 0 0' };
