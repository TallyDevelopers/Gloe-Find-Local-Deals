import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { BaseLayout } from './BaseLayout';

export interface SupportReplyData {
  firstName: string | null;
  /** The ticket subject, for context. */
  subject: string;
  /** The agent's reply, shown in full (Ryan's call: answer in the email itself). */
  replyBody: string;
}

/**
 * Support reply notice (GLO-40) — sent when an agent answers a ticket, so the
 * answer isn't trapped in-app. Includes the full reply text; replying to the
 * email reaches support@gloe.app (the BaseLayout footer says so), and the
 * thread also lives in the app under Profile → Support.
 */
export function SupportReplyEmail(d: SupportReplyData) {
  const hi = d.firstName ? `Hi ${d.firstName},` : 'Hi there,';
  return (
    <BaseLayout preview={d.replyBody.length > 110 ? `${d.replyBody.slice(0, 110)}…` : d.replyBody}>
      <Text style={h1}>{hi}</Text>
      <Text style={p}>
        We replied to your support request <strong>&ldquo;{d.subject}&rdquo;</strong>:
      </Text>

      <Section style={card}>
        <Text style={reply}>{d.replyBody}</Text>
      </Section>

      <Text style={fine}>
        You can continue the conversation right from the Gloē app — open <strong>Profile →
        Support</strong> — or simply reply to this email.
      </Text>
    </BaseLayout>
  );
}

const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1410', margin: '8px 0 4px' };
const p: React.CSSProperties = { fontSize: 15, color: '#4a4339', lineHeight: 1.5, margin: '0 0 16px' };
const card: React.CSSProperties = { backgroundColor: '#faf8f3', borderRadius: 10, padding: 16, border: '1px solid #ece6db', borderLeft: '3px solid #b8806f' };
const reply: React.CSSProperties = { fontSize: 15, color: '#1a1410', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' as const };
const fine: React.CSSProperties = { fontSize: 13, color: '#6b6358', lineHeight: 1.5, margin: '16px 0 0' };
