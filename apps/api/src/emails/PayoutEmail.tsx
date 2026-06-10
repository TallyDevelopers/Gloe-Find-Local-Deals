import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface PayoutData {
  businessName: string;
  dealTitle: string;
  /** The vendor's share that just moved to their Stripe balance, in cents. */
  amountCents: number;
  /** Stripe Express dashboard entry point (we link the generic login). */
  stripeDashboardUrl: string;
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Vendor payout notice (GLO-40) — sent when a redemption fires the Stripe
 * transfer of their share. "Money moved" is the one email vendors actually
 * want; it also quietly teaches them that redemptions are what trigger pay.
 */
export function PayoutEmail(d: PayoutData) {
  return (
    <BaseLayout preview={`A redemption at ${d.businessName} just moved ${money(d.amountCents)} to your Stripe balance.`}>
      <Text style={h1}>You got paid 🎉</Text>
      <Text style={p}>
        A customer just redeemed at <strong>{d.businessName}</strong>, and your share is on its way.
      </Text>

      <Section style={card}>
        <Text style={amount}>{money(d.amountCents)}</Text>
        <Text style={sub}>{d.dealTitle}</Text>
      </Section>

      <Text style={fine}>
        The money has been transferred to your Stripe balance and pays out to your bank on your
        regular payout schedule (or instantly, if you&apos;ve enabled instant payouts in your Gloē
        dashboard).
      </Text>

      <Section style={{ textAlign: 'center', marginTop: 20 }}>
        <Button href={d.stripeDashboardUrl} style={button}>
          View in Stripe
        </Button>
      </Section>
    </BaseLayout>
  );
}

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1410', margin: '8px 0 4px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '0 0 16px' };
const card: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: '20px 16px', border: '1px solid #ece6db', textAlign: 'center' };
const amount: React.CSSProperties = { fontSize: 32, fontWeight: 700, color: '#b8806f', margin: 0 };
const sub: React.CSSProperties = { fontSize: 13, color: '#6b6358', margin: '4px 0 0' };
const fine: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '16px 0 0' };
const button: React.CSSProperties = { backgroundColor: '#b8806f', borderRadius: 999, color: '#ffffff', fontSize: 14, fontWeight: 700, padding: '12px 28px', textDecoration: 'none' };
