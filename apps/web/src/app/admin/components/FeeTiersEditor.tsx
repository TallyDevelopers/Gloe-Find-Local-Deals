'use client';

import { useState } from 'react';

import { Card } from '../../../components/ui';
import { trpc } from '../../../lib/trpc';

interface FeeTiersEditorProps {
  /** null = global tiers. uuid = override tiers for that vendor only. */
  vendorId: string | null;
}

function money(cents: number | null): string {
  if (cents == null) return '∞';
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function FeeTiersEditor({ vendorId }: FeeTiersEditorProps) {
  const utils = trpc.useUtils();
  const q = trpc.admin.listFeeTiers.useQuery({ vendorId });

  const invalidate = () => utils.admin.listFeeTiers.invalidate({ vendorId });
  const create = trpc.admin.createFeeTier.useMutation({
    onSuccess: () => { void invalidate(); closeForm(); },
  });
  const update = trpc.admin.updateFeeTier.useMutation({
    onSuccess: () => { void invalidate(); closeForm(); },
  });
  const deactivate = trpc.admin.deactivateFeeTier.useMutation({ onSuccess: () => invalidate() });
  const reactivate = trpc.admin.reactivateFeeTier.useMutation({ onSuccess: () => invalidate() });

  // null = closed, 'new' = create form, otherwise the tier id being edited.
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm());

  const closeForm = () => { setEditingId(null); setForm(emptyForm()); };
  const openCreate = () => { setEditingId('new'); setForm(emptyForm()); };
  const openEdit = (t: { id: string; label: string; minCents: number; maxCents: number | null; percentBps: number; flatCents: number }) => {
    setEditingId(t.id);
    setForm({
      label: t.label,
      minDollars: (t.minCents / 100).toString(),
      maxDollars: t.maxCents == null ? '' : (t.maxCents / 100).toString(),
      type: t.flatCents > 0 ? 'flat' : 'percent',
      percent: t.flatCents > 0 ? '' : (t.percentBps / 100).toString(),
      flatDollars: t.flatCents > 0 ? (t.flatCents / 100).toString() : '',
    });
  };

  const rows = q.data ?? [];
  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);

  const submit = () => {
    const minCents = Math.round(parseFloat(form.minDollars || '0') * 100);
    const maxCents = form.maxDollars.trim() === '' ? null : Math.round(parseFloat(form.maxDollars) * 100);
    const isPercent = form.type === 'percent';
    const payload = {
      label: form.label || (maxCents == null ? `$${form.minDollars}+` : `$${form.minDollars}–$${form.maxDollars}`),
      minCents,
      maxCents,
      percentBps: isPercent ? Math.round(parseFloat(form.percent || '0') * 100) : 0,
      flatCents: isPercent ? 0 : Math.round(parseFloat(form.flatDollars || '0') * 100),
      vendorId,
    };
    if (editingId === 'new') {
      create.mutate(payload);
    } else if (editingId) {
      update.mutate({ id: editingId, ...payload });
    }
  };

  const writeMutation = editingId === 'new' ? create : update;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 19 }}>
          {vendorId == null ? 'Global tiers' : 'Vendor override tiers'}
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
            {active.length} active{inactive.length > 0 ? ` · ${inactive.length} inactive` : ''}
          </span>
        </h2>
        {editingId == null ? (
          <button onClick={openCreate} style={primaryBtn}>+ Add tier</button>
        ) : null}
      </div>

      {editingId != null ? (
        <div style={{ background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            {editingId === 'new' ? 'New tier' : 'Edit tier'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <LabeledInput label="Label (optional)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="e.g. Premium tier" />
            <LabeledInput label="Min $" value={form.minDollars} onChange={(v) => setForm({ ...form, minDollars: v })} placeholder="0" type="number" />
            <LabeledInput label="Max $ (blank = ∞)" value={form.maxDollars} onChange={(v) => setForm({ ...form, maxDollars: v })} placeholder="100" type="number" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <TypeChip on={form.type === 'percent'} onClick={() => setForm({ ...form, type: 'percent' })}>Percentage</TypeChip>
            <TypeChip on={form.type === 'flat'} onClick={() => setForm({ ...form, type: 'flat' })}>Flat fee</TypeChip>
          </div>
          <div style={{ marginTop: 12 }}>
            {form.type === 'percent' ? (
              <LabeledInput label="Percent" value={form.percent} onChange={(v) => setForm({ ...form, percent: v })} placeholder="12" type="number" suffix="%" />
            ) : (
              <LabeledInput label="Flat fee $" value={form.flatDollars} onChange={(v) => setForm({ ...form, flatDollars: v })} placeholder="60" type="number" />
            )}
          </div>
          {writeMutation.error ? (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)' }}>
              {writeMutation.error.message}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button onClick={closeForm} style={secondaryBtn}>Cancel</button>
            <button onClick={submit} disabled={writeMutation.isPending} style={primaryBtn}>
              {writeMutation.isPending ? 'Saving…' : editingId === 'new' ? 'Add tier' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}

      {q.isLoading ? (
        <div style={{ color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : (
        <>
          {active.length === 0 && inactive.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 14, padding: '12px 0' }}>
              {vendorId == null
                ? 'No tiers configured. Add one above. Until you do, bookings use a 12% safety default.'
                : 'No override tiers. This vendor uses the global tiers.'}
            </div>
          ) : null}

          {active.length > 0 ? (
            <TierTable
              tiers={active}
              activeMode
              onEdit={openEdit}
              onAction={(id) => deactivate.mutate({ id })}
              pending={deactivate.isPending}
            />
          ) : null}

          {inactive.length > 0 ? (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Show {inactive.length} inactive
              </summary>
              <TierTable
                tiers={inactive}
                activeMode={false}
                onEdit={openEdit}
                onAction={(id) => reactivate.mutate({ id })}
                pending={reactivate.isPending}
              />
              {reactivate.error ? (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>{reactivate.error.message}</div>
              ) : null}
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}

function TierTable({
  tiers,
  activeMode,
  onEdit,
  onAction,
  pending,
}: {
  tiers: { id: string; label: string; minCents: number; maxCents: number | null; percentBps: number; flatCents: number }[];
  activeMode: boolean;
  onEdit: (t: { id: string; label: string; minCents: number; maxCents: number | null; percentBps: number; flatCents: number }) => void;
  onAction: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {tiers.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 0',
            borderBottom: i === tiers.length - 1 ? 'none' : '1px solid var(--border-subtle)',
            opacity: activeMode ? 1 : 0.6,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {money(t.minCents)} – {money(t.maxCents)}
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {t.flatCents > 0 ? `flat ${money(t.flatCents)}` : `${(t.percentBps / 100).toFixed(t.percentBps % 100 === 0 ? 0 : 2)}%`}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEdit(t)} style={secondaryBtn}>Edit</button>
            <button
              onClick={() => onAction(t.id)}
              disabled={pending}
              style={activeMode ? destructiveBtn : secondaryBtn}
            >
              {activeMode ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
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
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          style={{
            flex: 1,
            padding: '8px 10px',
            fontSize: 14,
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
          }}
        />
        {suffix ? <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{suffix}</span> : null}
      </div>
    </label>
  );
}

function TypeChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: on ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
        background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
        color: on ? 'white' : 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 999,
  border: '1px solid var(--brand-500)',
  background: 'var(--brand-500)',
  color: 'white',
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
};
const destructiveBtn: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-secondary)',
};

function emptyForm() {
  return { label: '', minDollars: '', maxDollars: '', type: 'percent' as 'percent' | 'flat', percent: '', flatDollars: '' };
}
