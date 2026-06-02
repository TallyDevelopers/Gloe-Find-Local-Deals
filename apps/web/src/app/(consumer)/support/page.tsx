'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

const CATEGORIES = [
  { value: 'refund', label: 'Refund' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'other', label: 'Other' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  awaiting_us: 'We’re on it',
  awaiting_customer: 'Your reply needed',
  resolved: 'Resolved',
  closed: 'Closed',
};

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export default function SupportPage() {
  const router = useRouter();
  const tickets = trpc.support.list.useQuery();
  const [composing, setComposing] = useState(false);

  return (
    <div className="consumer-container" style={{ maxWidth: 720, paddingTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 30 }}>Concierge</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Questions about a booking, refund, or your account? We’re here.</p>
        </div>
        {!composing ? (
          <button type="button" onClick={() => setComposing(true)} style={primaryBtn}>New request</button>
        ) : null}
      </div>

      {composing ? (
        <ComposeForm
          onCancel={() => setComposing(false)}
          onCreated={(id) => router.push(`/support/${id}`)}
        />
      ) : tickets.isLoading ? (
        <p style={{ color: 'var(--text-tertiary)', marginTop: 24 }}>Loading…</p>
      ) : tickets.data && tickets.data.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
          {tickets.data.map((t) => (
            <Link key={t.id} href={`/support/${t.id}`} className="deal-card" style={{ display: 'block', padding: '16px 18px', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.unreadCount > 0 ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-500)', flexShrink: 0 }} /> : null}
                    <span style={{ fontWeight: 600, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                  </div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 13.5, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastMessagePreview}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={statusChip(t.status)}>{STATUS_LABEL[t.status] ?? t.status}</span>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>{relativeTime(t.lastMessageAt ?? t.createdAt)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-secondary)' }}>
          <p>No requests yet. Start one and we’ll get right back to you.</p>
        </div>
      )}
    </div>
  );
}

function ComposeForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [claimId, setClaimId] = useState<string | null>(null);

  const orders = trpc.support.myOrders.useQuery(
    { search: orderSearch || undefined },
    { enabled: orderSearch.trim().length >= 2 },
  );
  const create = trpc.support.create.useMutation({ onSuccess: (res) => onCreated(res.id) });

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !create.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        create.mutate({
          subject: subject.trim(),
          body: body.trim(),
          ...(category ? { category: category as 'refund' } : {}),
          ...(claimId ? { claimId } : {}),
        });
      }}
      style={{ marginTop: 22, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 24 }}
    >
      <label style={labelStyle}>Subject</label>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} placeholder="Briefly, what’s up?" style={inputStyle} />

      <label style={{ ...labelStyle, marginTop: 18 }}>Topic (optional)</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button key={c.value} type="button" onClick={() => setCategory(category === c.value ? null : c.value)} style={chip(category === c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <label style={{ ...labelStyle, marginTop: 18 }}>Related order (optional)</label>
      <input value={orderSearch} onChange={(e) => { setOrderSearch(e.target.value); setClaimId(null); }} placeholder="Search your vouchers…" style={inputStyle} />
      {orderSearch.trim().length >= 2 && orders.data && orders.data.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {orders.data.slice(0, 5).map((o) => (
            <button key={o.claimId} type="button" onClick={() => { setClaimId(o.claimId); setOrderSearch(`${o.dealTitle} · ${o.vendorName}`); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: claimId === o.claimId ? '2px solid var(--brand-500)' : '1px solid var(--border-default)', background: 'var(--surface-primary)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{o.dealTitle}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{o.vendorName}</div>
            </button>
          ))}
        </div>
      ) : null}

      <label style={{ ...labelStyle, marginTop: 18 }}>How can we help?</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={6} placeholder="Tell us what happened…" style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }} />

      {create.error ? <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 10 }}>{create.error.message}</p> : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="submit" disabled={!canSubmit} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.6 }}>
          {create.isPending ? 'Sending…' : 'Send request'}
        </button>
        <button type="button" onClick={onCancel} style={secondaryBtn}>Cancel</button>
      </div>
    </form>
  );
}

const primaryBtn: React.CSSProperties = { background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '12px 22px', fontSize: 15, fontWeight: 700 };
const secondaryBtn: React.CSSProperties = { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '12px 22px', fontSize: 15, fontWeight: 600 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: '100%', fontSize: 15, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-primary)', color: 'var(--text-primary)', outline: 'none' };

function chip(active: boolean): React.CSSProperties {
  return { fontSize: 13.5, fontWeight: 600, padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: active ? '1px solid var(--brand-500)' : '1px solid var(--border-subtle)', background: active ? 'var(--brand-500)' : 'var(--surface-primary)', color: active ? 'var(--text-inverse)' : 'var(--text-secondary)' };
}

function statusChip(status: string): React.CSSProperties {
  const done = status === 'resolved' || status === 'closed';
  return { fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: done ? 'var(--surface-secondary)' : 'var(--brand-100)', color: done ? 'var(--text-tertiary)' : 'var(--brand-600)', whiteSpace: 'nowrap' };
}
