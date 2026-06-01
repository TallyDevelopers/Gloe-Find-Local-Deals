'use client';

import { useEffect, useRef, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';

type Row = RouterOutputs['admin']['listSupportTickets'][number];
type StatusFilter = 'all' | 'awaiting_us' | 'awaiting_customer' | 'resolved' | 'closed';

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_us', label: 'Needs reply' },
  { key: 'awaiting_customer', label: 'Awaiting customer' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

/** Human-friendly status pill copy + colour. Mirrors the 5-state machine. */
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'var(--accent-500)', bg: 'rgba(178,93,64,0.10)' },
  awaiting_us: { label: 'Needs reply', color: 'var(--accent-500)', bg: 'rgba(178,93,64,0.12)' },
  awaiting_customer: { label: 'Awaiting customer', color: 'var(--text-secondary)', bg: 'var(--surface-secondary)' },
  resolved: { label: 'Resolved', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
  closed: { label: 'Closed', color: 'var(--text-tertiary)', bg: 'var(--surface-secondary)' },
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SupportView() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const list = trpc.admin.listSupportTickets.useQuery({
    query: search || undefined,
    status: status === 'all' ? undefined : status,
  });

  // Order: tickets that need our reply first, then most-recently-active. The
  // server may already sort, but we re-sort defensively so god mode always
  // sees the fire-drill rows up top regardless of query path.
  const rows = (list.data ?? []).slice().sort((a, b) => {
    const aNeeds = a.status === 'awaiting_us' || a.status === 'open' ? 0 : 1;
    const bNeeds = b.status === 'awaiting_us' || b.status === 'open' ? 0 : 1;
    if (aNeeds !== bNeeds) return aNeeds - bNeeds;
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Support</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Every conversation, one inbox. Reply, resolve, and close from here.
        </p>
      </div>

      <div style={toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Customer, email, or subject…"
          style={searchInput}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_FILTERS.map((f) => {
            const active = status === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: active ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
                  background: active ? 'var(--brand-500)' : 'var(--surface-default)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={tableShell}>
        {list.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No tickets match.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                <Th>Customer</Th>
                <Th>Email</Th>
                <Th>Subject</Th>
                <Th align="right">Msgs</Th>
                <Th align="right">Unread</Th>
                <Th>Status</Th>
                <Th>Last activity</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  style={{
                    cursor: 'pointer',
                    borderTop: '1px solid var(--border-subtle)',
                    background: selected === t.id ? 'var(--brand-50)' : 'transparent',
                  }}
                >
                  <Td><strong>{t.customerName || (t.customerEmail ?? '—')}</strong></Td>
                  <Td style={{ color: 'var(--text-secondary)' }}>{t.customerEmail ?? '—'}</Td>
                  <Td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</Td>
                  <Td align="right" mono>{t.messageCount}</Td>
                  <Td align="right" mono>
                    {t.unreadFromCustomer > 0 ? (
                      <span style={{ display: 'inline-block', minWidth: 20, padding: '1px 7px', borderRadius: 999, background: 'var(--accent-500)', color: '#fff', fontWeight: 700 }}>
                        {t.unreadFromCustomer}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>0</span>
                    )}
                  </Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td style={{ color: 'var(--text-secondary)' }}>{relativeTime(t.lastMessageAt)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <SupportTicketDrawer
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => list.refetch()}
        />
      ) : null}
    </div>
  );
}

type Customer = RouterOutputs['admin']['supportTicketCustomer'];
type Order = RouterOutputs['admin']['supportTicketOrders']['orders'][number];

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Boss view — the customer at a glance: who, money, behavior. */
function CustomerBossView({ customer: c, loading }: { customer: Customer | null; loading: boolean }) {
  if (loading || !c) {
    return <div style={{ padding: '14px 24px', fontSize: 12, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>Loading customer…</div>;
  }
  const netCents = c.lifetimePaidCents - c.refundedCents;
  // Quick "who is this" read: whale, refund-heavy, new, or normal.
  const refundRate = c.lifetimePaidCents > 0 ? c.refundedCents / c.lifetimePaidCents : 0;
  const tags: { label: string; bg: string; color: string }[] = [];
  if (c.lifetimePaidCents >= 50000) tags.push({ label: '💎 High value', bg: 'var(--brand-50)', color: 'var(--brand-700)' });
  if (refundRate >= 0.3) tags.push({ label: '⚠ Refund-heavy', bg: 'rgba(218,79,71,0.10)', color: 'var(--error)' });
  if (c.purchaseCount <= 1) tags.push({ label: '🆕 New', bg: 'var(--surface-secondary)', color: 'var(--text-secondary)' });
  if (c.ticketCount >= 4) tags.push({ label: '🔁 Frequent contact', bg: 'var(--surface-secondary)', color: 'var(--text-secondary)' });

  const initials = (c.name?.[0] ?? c.email?.[0] ?? '?').toUpperCase();
  const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div style={{ flex: 1, minWidth: 72, padding: '8px 10px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 1, color: accent ? 'var(--brand-600)' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--brand-100)', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{initials}</div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name ?? c.email ?? 'Customer'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {c.email ? <span>{c.email}</span> : null}
            {c.phone ? <span>· {c.phone}</span> : null}
            <span>· member {relTime(c.memberSince)}</span>
            {c.city ? <span>· {c.city}</span> : null}
          </div>
        </div>
      </div>

      {tags.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <span key={t.label} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: t.bg, color: t.color }}>{t.label}</span>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Stat label="Net spend" value={money(netCents)} accent />
        <Stat label="Orders" value={String(c.purchaseCount)} />
        <Stat label="Redeemed" value={String(c.redemptionCount)} />
        <Stat label="Refunded" value={c.refundedCents > 0 ? money(c.refundedCents) : '$0'} />
        <Stat label="Tickets" value={`${c.ticketCount}${c.openTicketCount > 1 ? ` · ${c.openTicketCount} open` : ''}`} />
      </div>
    </div>
  );
}

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Rewrite a Supabase public-storage URL to its on-the-fly image transform
 * (a resized thumbnail) so god-mode doesn't pull the full multi-MB original to
 * render a tiny preview. A 6MB phone photo → ~280KB at width=240. Falls back to
 * the original URL if it's not a Supabase public-object URL.
 */
function thumbUrl(url: string, width: number): string {
  if (!url.includes('/storage/v1/object/public/')) return url;
  const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = transformed.includes('?') ? '&' : '?';
  return `${transformed}${sep}width=${width}&quality=70`;
}

/** Customer order history shown in the support drawer. Collapsible + searchable;
 * the linked order is flagged. Server caps to recent 50 (search to find older). */
function OrdersPanel({ orders, linkedClaimId, loading, search, onSearch }: { orders: Order[]; linkedClaimId: string | null; loading: boolean; search: string; onSearch: (s: string) => void }) {
  const [open, setOpen] = useState(true);
  const claimStatusColor = (s: string) =>
    s === 'redeemed' ? 'var(--brand-600)' : s === 'active' ? 'var(--accent-500)' : 'var(--text-tertiary)';

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-secondary)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        <span>Orders{orders.length ? ` · ${orders.length}${orders.length >= 50 ? '+' : ''}` : ''}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div style={{ padding: '0 16px 12px' }}>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search orders by deal or vendor…"
            style={{ width: '100%', padding: '7px 10px', marginBottom: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', fontSize: 12, color: 'var(--text-primary)' }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>Loading…</div>
          ) : orders.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>{search ? 'No orders match.' : 'No orders for this customer.'}</div>
          ) : null}
          {orders.map((o) => {
            const linked = o.claimId === linkedClaimId;
            const refunded = o.refundedCents > 0;
            return (
              <div
                key={o.claimId}
                style={{
                  padding: '10px 12px', marginTop: 6, borderRadius: 'var(--radius-md)',
                  background: linked ? 'var(--brand-50)' : 'var(--surface-elevated)',
                  border: linked ? '1px solid var(--brand-300, var(--border-default))' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {linked ? '📌 ' : ''}{o.dealTitle}
                  </strong>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-600)', whiteSpace: 'nowrap' }}>{money(o.consumerPaidCents)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>{o.vendorName}</span>
                  <span>· bought {shortDate(o.purchasedAt)}</span>
                  <span style={{ color: claimStatusColor(o.claimStatus), fontWeight: 600, textTransform: 'capitalize' }}>· {o.claimStatus}</span>
                  {o.redeemedAt ? <span>· redeemed {shortDate(o.redeemedAt)}</span> : <span>· expires {shortDate(o.expiresAt)}</span>}
                  {refunded ? <span style={{ color: 'var(--error)', fontWeight: 600 }}>· refunded {money(o.refundedCents)}</span> : null}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'var(--text-secondary)', bg: 'var(--surface-secondary)' };
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        color: meta.color,
        background: meta.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}

type Detail = NonNullable<RouterOutputs['admin']['supportTicketDetail']>;
type Message = Detail['messages'][number];

function SupportTicketDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const q = trpc.admin.supportTicketDetail.useQuery({ id });
  const d = q.data;
  const customerQ = trpc.admin.supportTicketCustomer.useQuery({ ticketId: id });
  const [orderSearch, setOrderSearch] = useState('');
  const ordersQ = trpc.admin.supportTicketOrders.useQuery({ ticketId: id, search: orderSearch || undefined });

  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const replyMutation = trpc.admin.replySupportTicket.useMutation();
  const statusMutation = trpc.admin.setSupportTicketStatus.useMutation();

  // Keep the conversation pinned to the newest message whenever it grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [d?.messages.length]);

  const refresh = async () => {
    await q.refetch();
    onChanged();
  };

  const send = async () => {
    const body = reply.trim();
    if (!body) return;
    setError(null);
    try {
      await replyMutation.mutateAsync({ ticketId: id, body });
      setReply('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reply failed.');
    }
  };

  const setStatus = async (next: 'resolved' | 'closed') => {
    setError(null);
    try {
      await statusMutation.mutateAsync({ ticketId: id, status: next });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update status.');
    }
  };

  const busy = replyMutation.isPending || statusMutation.isPending;
  const isClosed = d?.ticket.status === 'closed';
  const isResolved = d?.ticket.status === 'resolved';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.45)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100vw)',
          height: '100%',
          background: 'var(--surface-elevated)',
          borderLeft: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 19, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d ? d.ticket.subject : 'Ticket'}
            </h2>
            {d ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>{d.ticket.customerName || (d.ticket.customerEmail ?? '—')}</strong>
                <span>·</span>
                <span>{d.ticket.customerEmail ?? '—'}</span>
                <span>·</span>
                <span style={{ textTransform: 'capitalize' }}>{d.ticket.category}</span>
                <StatusPill status={d.ticket.status} />
              </div>
            ) : null}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Boss view — who you're dealing with, at a glance. */}
        <CustomerBossView customer={customerQ.data ?? null} loading={customerQ.isLoading} />

        {/* Customer order history — the context for the ticket. The linked order
            (if the customer tagged one) is flagged. */}
        <OrdersPanel
          orders={ordersQ.data?.orders ?? []}
          linkedClaimId={ordersQ.data?.linkedClaimId ?? null}
          loading={ordersQ.isLoading}
          search={orderSearch}
          onSearch={setOrderSearch}
        />

        {!d ? (
          <div style={{ padding: 24, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.messages.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No messages yet.</div>
              ) : (
                d.messages.map((m) => <Bubble key={m.id} m={m} />)
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {error ? (
                <div style={{ fontSize: 12, color: 'var(--error)', padding: '8px 10px', background: 'rgba(218,79,71,0.08)', borderRadius: 'var(--radius-md)' }}>
                  {error}
                </div>
              ) : null}

              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply to the customer…"
                rows={3}
                disabled={busy}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void send();
                  }
                }}
                style={{
                  width: '100%',
                  resize: 'vertical',
                  minHeight: 64,
                  padding: '10px 12px',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-default)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!isResolved ? (
                    <button
                      type="button"
                      onClick={() => void setStatus('resolved')}
                      disabled={busy}
                      style={ghostBtn}
                    >
                      Mark resolved
                    </button>
                  ) : null}
                  {!isClosed ? (
                    <button
                      type="button"
                      onClick={() => void setStatus('closed')}
                      disabled={busy}
                      style={ghostBtn}
                    >
                      Close
                    </button>
                  ) : null}
                </div>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || reply.trim().length === 0}
                  style={{
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    border: '1px solid var(--brand-500)',
                    background: reply.trim().length > 0 && !busy ? 'var(--brand-500)' : 'var(--surface-secondary)',
                    color: reply.trim().length > 0 && !busy ? '#fff' : 'var(--text-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    cursor: reply.trim().length > 0 && !busy ? 'pointer' : 'not-allowed',
                  }}
                >
                  {replyMutation.isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  // system = centered muted note; customer = neutral left; agent (You/Gloē) =
  // brand-tinted, right-aligned. Sender labels match the mobile chat copy.
  if (m.senderType === 'system') {
    return (
      <div style={{ alignSelf: 'center', maxWidth: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '4px 0' }}>
          {m.body}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{relativeTime(m.createdAt)}</div>
      </div>
    );
  }

  const isAgent = m.senderType === 'agent';
  return (
    <div style={{ alignSelf: isAgent ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      <div
        style={{
          padding: '9px 13px',
          borderRadius: 'var(--radius-lg)',
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--text-primary)',
          background: isAgent ? 'var(--brand-50)' : 'var(--surface-secondary)',
          border: isAgent ? '1px solid var(--brand-100, var(--border-subtle))' : '1px solid var(--border-subtle)',
          borderBottomRightRadius: isAgent ? 4 : 'var(--radius-lg)',
          borderBottomLeftRadius: isAgent ? 'var(--radius-lg)' : 4,
        }}
      >
        {m.body}
      </div>
      {m.attachments && m.attachments.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
          {m.attachments.map((a) =>
            a.kind === 'video' ? (
              <video
                key={a.id}
                src={a.url}
                controls
                style={{ width: 200, borderRadius: 'var(--radius-md)', background: '#000' }}
              />
            ) : (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl(a.thumbnailUrl ?? a.url, 240)}
                  alt="attachment"
                  loading="lazy"
                  style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 'var(--radius-md)', display: 'block', background: 'var(--surface-secondary)' }}
                />
              </a>
            ),
          )}
        </div>
      ) : null}
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, textAlign: isAgent ? 'right' : 'left' }}>
        {m.senderType === 'agent' ? 'You · Gloē' : m.senderType === 'system' ? 'System' : 'Customer'} · {relativeTime(m.createdAt)}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <th style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: align ?? 'left', whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children, align, mono, style }: { children: React.ReactNode; align?: 'right'; mono?: boolean; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 14px', textAlign: align ?? 'left', fontVariantNumeric: mono ? 'tabular-nums' : 'normal', whiteSpace: 'nowrap', ...style }}>{children}</td>;
}

const tableShell: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'auto',
};
const toolbar: React.CSSProperties = {
  display: 'flex', gap: 10, padding: 10, flexWrap: 'wrap', alignItems: 'center',
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
const searchInput: React.CSSProperties = {
  flex: 1, minWidth: 220, padding: '8px 12px', fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};
