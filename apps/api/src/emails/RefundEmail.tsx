import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface RefundData {
  firstName: string | null;
  dealTitle: string;
  vendorName: string;
  /** What the customer originally paid, in cents. */
  originalPaidCents: number;
  /** Amount refunded on THIS action, in cents. */
  amountCents: number;
  /** Cumulative refunded on this order AFTER this action, in cents. */
  totalRefundedCents: number;
  /** True = full refund (voucher cancelled); false = partial. */
  isFullRefund: boolean;
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Refund confirmation — sent when a refund is issued (full or partial). */
export function RefundEmail(d: RefundData) {
  const hi = d.firstName ? `Hi ${d.firstName},` : 'Hi there,';
  return (
    <BaseLayout preview={`Your ${money(d.amountCents)} refund from Gloē`}>
      <Text style={h1}>{hi}</Text>
      <Text style={p}>
        We&apos;ve refunded <strong>{money(d.amountCents)}</strong> for your purchase at {d.vendorName}.
      </Text>

      <Section style={card}>
        <Text style={dealName}>{d.dealTitle}</Text>
        <Text style={sub}>{d.vendorName}</Text>
        <Section style={{ marginTop: 12, borderTop: '1px solid #ece6db', paddingTop: 12 }}>
          <table style={{ width: '100%' }}>
            <tbody>
              <Line label="Original total" value={money(d.originalPaidCents)} />
              <Line label="Refunded now" value={'−' + money(d.amountCents)} accent />
              {d.totalRefundedCents !== d.amountCents ? (
                <Line label="Refunded in total" value={'−' + money(d.totalRefundedCents)} />
              ) : null}
              <Line label="Remaining charge" value={money(d.originalPaidCents - d.totalRefundedCents)} bold divider />
            </tbody>
          </table>
        </Section>
      </Section>

      <Text style={fine}>
        The refund goes back to your original payment method and typically appears within <strong>5–10 business days</strong>,
        depending on your bank.
        {d.isFullRefund
          ? ' Your voucher has been cancelled.'
          : ' This was a partial refund — your voucher is still active for the remaining balance.'}
      </Text>
    </BaseLayout>
  );
}

function Line({ label, value, bold, accent, divider }: { label: string; value: string; bold?: boolean; accent?: boolean; divider?: boolean }) {
  const td: React.CSSProperties = {
    fontSize: 14, paddingTop: divider ? 8 : 2,
    borderTop: divider ? '1px solid #ece6db' : undefined,
  };
  return (
    <tr>
      <td style={{ ...td, color: '#6b6358' }}>{label}</td>
      <td style={{ ...td, textAlign: 'right', fontWeight: bold ? 700 : 400, color: accent ? '#b8806f' : '#1a1410' }}>{value}</td>
    </tr>
  );
}

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1410', margin: '8px 0 4px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '0 0 16px' };
const card: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: 16, border: '1px solid #ece6db' };
const dealName: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#1a1410', margin: 0 };
const sub: React.CSSProperties = { fontSize: 13, color: '#6b6358', margin: '2px 0 0' };
const fine: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '16px 0 0' };
