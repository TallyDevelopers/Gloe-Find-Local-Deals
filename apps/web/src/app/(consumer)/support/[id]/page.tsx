'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { trpc } from '../../../../lib/trpc';

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  awaiting_us: 'We’re on it',
  awaiting_customer: 'Awaiting your reply',
  resolved: 'Resolved',
  closed: 'Closed',
};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SupportThreadPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();
  const caseQuery = trpc.support.getCase.useQuery({ id }, { enabled: !!id });
  const markRead = trpc.support.markRead.useMutation();
  const reply = trpc.support.reply.useMutation({
    onSuccess: () => {
      setBody('');
      void utils.support.getCase.invalidate({ id });
      void utils.support.list.invalidate();
    },
  });
  const [body, setBody] = useState('');
  const markedRef = useRef(false);

  // Clear unread agent messages once, after the thread loads.
  useEffect(() => {
    if (id && caseQuery.data && !markedRef.current) {
      markedRef.current = true;
      markRead.mutate({ ticketId: id });
      void utils.support.list.invalidate();
    }
  }, [id, caseQuery.data, markRead, utils]);

  if (caseQuery.isLoading) return <div className="consumer-container" style={{ paddingTop: 40 }}>Loading…</div>;
  if (caseQuery.error || !caseQuery.data) {
    return (
      <div className="consumer-container" style={{ paddingTop: 80, textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>Request not found</h1>
        <Link href="/support" style={{ display: 'inline-block', marginTop: 14, color: 'var(--brand-600)', fontWeight: 600 }}>← Back to Concierge</Link>
      </div>
    );
  }

  const { ticket, messages } = caseQuery.data;

  return (
    <div className="consumer-container" style={{ maxWidth: 680, paddingTop: 20 }}>
      <Link href="/support" style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>← Concierge</Link>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: 24 }}>{ticket.subject}</h1>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-secondary)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {STATUS_LABEL[ticket.status] ?? ticket.status}
        </span>
      </div>

      {/* Thread */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        {messages.map((m) => {
          if (m.senderType === 'system') {
            return (
              <div key={m.id} style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-tertiary)' }}>{m.body}</div>
            );
          }
          const mine = m.senderType === 'customer';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%' }}>
                {!mine ? <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4, letterSpacing: '0.04em' }}>GLOĒ TEAM</div> : null}
                <div
                  style={{
                    background: mine ? 'var(--brand-100)' : 'var(--surface-elevated)',
                    border: mine ? 'none' : '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: 16,
                    padding: '11px 14px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.body}
                  {m.attachments.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                      {m.attachments.map((a) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={a.id} src={a.thumbnailUrl ?? a.url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, textAlign: mine ? 'right' : 'left' }}>{timeOf(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) reply.mutate({ ticketId: id, body: body.trim() });
        }}
        style={{ position: 'sticky', bottom: 0, background: 'var(--surface-primary)', paddingTop: 16, marginTop: 20 }}
      >
        {ticket.status === 'resolved' || ticket.status === 'closed' ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>This request was {STATUS_LABEL[ticket.status]?.toLowerCase()}. Replying will reopen it.</p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder="Write a reply…"
            style={{ flex: 1, fontSize: 15, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', minHeight: 46, maxHeight: 160 }}
          />
          <button type="submit" disabled={!body.trim() || reply.isPending} style={{ background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '12px 22px', fontWeight: 700, opacity: !body.trim() || reply.isPending ? 0.6 : 1, flexShrink: 0 }}>
            {reply.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {reply.error ? <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 8 }}>{reply.error.message}</p> : null}
      </form>
    </div>
  );
}
