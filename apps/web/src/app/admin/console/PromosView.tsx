'use client';

import { useState } from 'react';

import { Card } from '../../../components/ui';
import { trpc } from '../../../lib/trpc';

/**
 * God mode — Deal promos (GLO-44). Place a PLATFORM-funded "Extra $X off" on
 * any live deal (it comes out of the platform fee; the vendor is paid in full
 * on the original price), watch every running promo's cost-to-date, and end
 * any promo early — including vendor-funded boosts when needed.
 */

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function autoLabel(amountCents: number): string {
  return `Extra ${money(amountCents)} off`;
}

export function PromosView() {
  const utils = trpc.useUtils();
  const list = trpc.admin.listDealPromos.useQuery({ includeEnded: true });
  const invalidate = () => utils.admin.listDealPromos.invalidate();

  const create = trpc.admin.createDealPromo.useMutation({
    onSuccess: () => { void invalidate(); closeForm(); },
  });
  const end = trpc.admin.endDealPromo.useMutation({ onSuccess: () => invalidate() });

  const [formOpen, setFormOpen] = useState(false);
  const [dealQuery, setDealQuery] = useState('');
  const [pickedDeal, setPickedDeal] = useState<{ id: string; title: string; vendorName: string } | null>(null);
  const [amountDollars, setAmountDollars] = useState('');
  const [label, setLabel] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const search = trpc.deals.search.useQuery(
    { q: dealQuery, limit: 8 },
    { enabled: formOpen && dealQuery.trim().length >= 2 && !pickedDeal },
  );

  const closeForm = () => {
    setFormOpen(false);
    setDealQuery('');
    setPickedDeal(null);
    setAmountDollars('');
    setLabel('');
    setEndsAt('');
  };

  const amountCents = Math.round(parseFloat(amountDollars || '0') * 100);
  const canSubmit = !!pickedDeal && amountCents > 0 && !!endsAt;

  const submit = () => {
    if (!canSubmit || !pickedDeal) return;
    create.mutate({
      dealId: pickedDeal.id,
      amountCents,
      label: label.trim() || null,
      endsAt: new Date(endsAt).toISOString(),
    });
  };

  const rows = list.data ?? [];
  const live = rows.filter((r) => r.isLive);
  const past = rows.filter((r) => !r.isLive);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19 }}>
          Deal promos
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
            {live.length} live{past.length > 0 ? ` · ${past.length} past` : ''}
          </span>
        </h2>
        {!formOpen ? (
          <button onClick={() => setFormOpen(true)} style={primaryBtn}>+ New promo</button>
        ) : null}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 16px', maxWidth: 640 }}>
        A promo is a public &ldquo;Extra $X off&rdquo; on one deal — badge on the card, automatic
        discount line at checkout. Promos you create here are <strong>platform-funded</strong>:
        the vendor is still paid in full on the original price and the discount comes out of
        the Gloē fee. Vendors fund their own boosts from their dashboard.
      </p>

      {formOpen ? (
        <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            New platform-funded promo
          </div>

          {pickedDeal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{pickedDeal.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{pickedDeal.vendorName}</div>
              </div>
              <button onClick={() => { setPickedDeal(null); setDealQuery(''); }} style={secondaryBtn}>Change deal</button>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <LabeledInput label="Find the deal" value={dealQuery} onChange={setDealQuery} placeholder="Search by deal title or spa name…" />
              {dealQuery.trim().length >= 2 ? (
                <div style={{ marginTop: 6, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {search.isLoading ? (
                    <div style={{ padding: 10, fontSize: 13, color: 'var(--text-tertiary)' }}>Searching…</div>
                  ) : (search.data?.deals ?? []).length === 0 ? (
                    <div style={{ padding: 10, fontSize: 13, color: 'var(--text-tertiary)' }}>No live deals match.</div>
                  ) : (
                    (search.data?.deals ?? []).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setPickedDeal({ id: d.id, title: d.title, vendorName: d.vendor.businessName })}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px',
                          background: 'var(--surface-elevated)', border: 'none',
                          borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                          {d.vendor.businessName}
                          {d.promo ? ' · already has a promo' : ''}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <LabeledInput label="Extra off $" value={amountDollars} onChange={setAmountDollars} placeholder="15" type="number" />
            <LabeledInput label="Badge label (optional)" value={label} onChange={setLabel} placeholder={amountCents > 0 ? autoLabel(amountCents) : 'Extra $15 off'} />
            <LabeledInput label="Ends" value={endsAt} onChange={setEndsAt} type="datetime-local" />
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-tertiary)' }}>
            Badge will read <strong>{label.trim() || (amountCents > 0 ? autoLabel(amountCents) : '…')}</strong>.
            Leaving the label blank keeps the copy auto-generated, so it can never go stale.
          </div>

          {create.error ? (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>{create.error.message}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={closeForm} style={secondaryBtn}>Cancel</button>
            <button onClick={submit} disabled={!canSubmit || create.isPending} style={{ ...primaryBtn, opacity: canSubmit ? 1 : 0.5 }}>
              {create.isPending ? 'Placing…' : 'Place promo'}
            </button>
          </div>
        </div>
      ) : null}

      {list.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : (
        <>
          {live.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '12px 0' }}>
              No live promos. Place one above to put an &ldquo;Extra $X off&rdquo; badge on a deal.
            </div>
          ) : (
            <PromoTable promos={live} liveMode onEnd={(id) => end.mutate({ promoId: id })} pending={end.isPending} />
          )}
          {end.error ? (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{end.error.message}</div>
          ) : null}

          {past.length > 0 ? (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Show {past.length} past
              </summary>
              <PromoTable promos={past} liveMode={false} onEnd={() => undefined} pending={false} />
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}

type PromoItem = {
  id: string;
  dealTitle: string;
  vendorName: string;
  amountCents: number;
  fundedBy: 'platform' | 'vendor';
  label: string | null;
  endsAt: string;
  orderCount: number;
  costToDateCents: number;
};

function PromoTable({
  promos,
  liveMode,
  onEnd,
  pending,
}: {
  promos: PromoItem[];
  liveMode: boolean;
  onEnd: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {promos.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: i === promos.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            opacity: liveMode ? 1 : 0.6, flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {p.label || autoLabel(p.amountCents)}
              <span style={fundChip(p.fundedBy)}>{p.fundedBy === 'platform' ? 'Gloē-funded' : 'Vendor boost'}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {p.dealTitle} · {p.vendorName} · {liveMode ? 'ends' : 'ended'}{' '}
              {new Date(p.endsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>−{money(p.amountCents)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {p.orderCount} order{p.orderCount === 1 ? '' : 's'} · {money(p.costToDateCents)} to date
            </div>
          </div>
          {liveMode ? (
            <button onClick={() => onEnd(p.id)} disabled={pending} style={destructiveBtn}>
              End promo
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          padding: '8px 10px', fontSize: 14,
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-elevated)',
          color: 'var(--text-primary)',
        }}
      />
    </label>
  );
}

function fundChip(fundedBy: 'platform' | 'vendor'): React.CSSProperties {
  return {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    verticalAlign: 'middle',
    background: fundedBy === 'platform' ? 'var(--brand-500)' : 'var(--surface-secondary)',
    color: fundedBy === 'platform' ? '#fff' : 'var(--text-secondary)',
    border: fundedBy === 'platform' ? 'none' : '1px solid var(--border-default)',
  };
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 999,
  border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: 'white',
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
};
const destructiveBtn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)',
};
