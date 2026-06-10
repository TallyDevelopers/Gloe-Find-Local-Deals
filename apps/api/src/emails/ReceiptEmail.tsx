import { Button, Img, Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface ReceiptData {
  firstName: string | null;
  dealTitle: string;
  vendorName: string;
  variantLabel: string;
  quantity: number;
  /** What the customer actually paid, in cents (total across quantity). */
  amountPaidCents: number;
  /** Voucher redemption code(s) — one per quantity. */
  codes: string[];
  /** Human date the voucher(s) expire. */
  expiresAt: string;
  /** Deal hero photo — rendered as a banner. Null/blocked falls back gracefully. */
  photoUrl?: string | null;
  /** Link to the web wallet (e.g. https://gloe.app/wallet) for the QR. */
  walletUrl: string;
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Purchase receipt — sent on payment success (payment_intent.succeeded). */
export function ReceiptEmail(d: ReceiptData) {
  const hi = d.firstName ? `Thanks, ${d.firstName}!` : 'Thanks for your purchase!';
  return (
    <BaseLayout preview={`${d.codes.length > 1 ? `${d.codes.length} voucher codes` : `Code ${d.codes[0]}`} · valid through ${d.expiresAt} · show it at ${d.vendorName}`}>
      <Text style={h1}>{hi}</Text>
      <Text style={p}>Your purchase is confirmed. Here&apos;s your receipt.</Text>

      {d.photoUrl ? (
        <Img src={d.photoUrl} alt={d.dealTitle} width={416} style={banner} />
      ) : null}

      <Section style={card}>
        <Text style={dealName}>{d.dealTitle}</Text>
        <Text style={sub}>{d.vendorName} · {d.variantLabel}{d.quantity > 1 ? ` × ${d.quantity}` : ''}</Text>
        <Section style={{ marginTop: 12, borderTop: '1px solid #ece6db', paddingTop: 12 }}>
          <Row label="Paid" value={money(d.amountPaidCents)} bold />
        </Section>
      </Section>

      <Text style={label}>{d.codes.length > 1 ? 'Your voucher codes' : 'Your voucher code'}</Text>
      {d.codes.map((c) => (
        <Text key={c} style={code}>{c}</Text>
      ))}
      <Text style={fine}>
        Show {d.codes.length > 1 ? 'these codes' : 'this code'} (or your QR) at {d.vendorName} to redeem.
        Valid through {d.expiresAt}.
      </Text>

      <Section style={howCard}>
        <Text style={howTitle}>How to pull up your QR code</Text>
        <Text style={howLine}>
          <strong>On your phone:</strong> open the Gloē app and tap the <strong>Wallet</strong> tab — your voucher and its QR code are right there.
        </Text>
        <Text style={howLine}>
          <strong>On a computer:</strong> open your wallet on the web with the button below.
        </Text>
        <Button href={d.walletUrl} style={btn}>View my wallet</Button>
      </Section>
    </BaseLayout>
  );
}

function Row({ label: l, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <table style={{ width: '100%' }}>
      <tbody>
        <tr>
          <td style={{ fontSize: 14, color: '#6b6358' }}>{l}</td>
          <td style={{ fontSize: 14, color: '#1a1410', textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{value}</td>
        </tr>
      </tbody>
    </table>
  );
}

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1410', margin: '8px 0 4px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '0 0 16px' };
const card: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: 16, border: '1px solid #ece6db' };
const dealName: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#1a1410', margin: 0 };
const sub: React.CSSProperties = { fontSize: 13, color: '#6b6358', margin: '2px 0 0' };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e8f', margin: '20px 0 6px' };
const code: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', color: '#b8806f', fontFamily: 'monospace', margin: '0 0 4px' };
const banner: React.CSSProperties = { width: '100%', maxWidth: 416, height: 'auto', borderRadius: 10, objectFit: 'cover', display: 'block', margin: '0 0 16px' };
const howCard: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: 16, border: '1px solid #ece6db', marginTop: 20 };
const howTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#1a1410', margin: '0 0 8px' };
const howLine: React.CSSProperties = { fontSize: 13, color: '#4a4339', lineHeight: 1.5, margin: '0 0 8px' };
const btn: React.CSSProperties = { backgroundColor: '#b8806f', color: '#ffffff', fontSize: 14, fontWeight: 700, textDecoration: 'none', padding: '10px 20px', borderRadius: 999, display: 'inline-block', marginTop: 4 };
const fine: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '10px 0 0' };
