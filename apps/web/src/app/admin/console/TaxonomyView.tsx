'use client';

import { useMemo, useState } from 'react';

import { trpc } from '../../../lib/trpc';

/**
 * Treatments (taxonomy) — god-mode editor for service categories and the
 * treatments under them. This is the spine of the marketplace: vendor signup
 * chips, the deal form's treatment picker, Discover pills, and search all read
 * these tables live, so an edit here is everywhere within a minute (clients
 * cache categories.list briefly). Removing = hiding (deals keep their tag);
 * hard delete only exists for treatments no deal has ever used.
 */
export function TaxonomyView() {
  const utils = trpc.useUtils();
  const taxonomyQ = trpc.admin.listTaxonomy.useQuery();

  const createSub = trpc.admin.createSubtype.useMutation();
  const updateSub = trpc.admin.updateSubtype.useMutation();
  const deleteSub = trpc.admin.deleteSubtype.useMutation();
  const reorderSubs = trpc.admin.reorderSubtypes.useMutation();
  const updateCat = trpc.admin.updateCategory.useMutation();

  const [filter, setFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  // 'new:<catId>' = add form under that category; a subtype id = inline edit.
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => Promise.all([
    utils.admin.listTaxonomy.invalidate(),
    utils.categories.list.invalidate(), // consumer/vendor pickers share this cache
  ]);

  const categories = taxonomyQ.data ?? [];
  const f = filter.trim().toLowerCase();

  const visible = useMemo(() => {
    return categories
      .filter((c) => showHidden || c.active)
      .map((c) => ({
        ...c,
        subtypes: c.subtypes.filter(
          (s) =>
            (showHidden || s.active) &&
            (!f || s.displayName.toLowerCase().includes(f) || s.slug.includes(f)),
        ),
      }))
      .filter((c) => !f || c.subtypes.length > 0 || c.displayName.toLowerCase().includes(f));
  }, [categories, showHidden, f]);

  const isOpen = (id: string) => f.length > 0 || openCats.has(id);
  const toggleOpen = (id: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const moveSub = (cat: { id: string; subtypes: { id: string }[] }, index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= cat.subtypes.length) return;
    const ids = cat.subtypes.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    void run(() => reorderSubs.mutateAsync({ categoryId: cat.id, orderedIds: ids }));
  };

  const totalActive = categories.reduce((n, c) => n + c.subtypes.filter((s) => s.active).length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Treatments</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4, maxWidth: 640 }}>
            The master menu — {totalActive} live treatments across {categories.filter((c) => c.active).length} categories.
            Everything here feeds vendor signup, the deal form, Discover pills, and search the moment you save.
            Hiding a treatment removes it from every picker but keeps existing deals intact.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search treatments…"
            style={{ ...textInput, width: 220 }}
          />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden
          </label>
        </div>
      </div>

      {err ? <div style={{ color: 'var(--error)', fontSize: 13 }}>{err}</div> : null}

      {taxonomyQ.isLoading ? (
        <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : (
        visible.map((cat) => (
          <div key={cat.id} style={tableShell}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-secondary)' }}>
              <button onClick={() => toggleOpen(cat.id)} style={{ ...linkBtn, fontSize: 15, color: 'var(--text-primary)' }}>
                {isOpen(cat.id) ? '▾' : '▸'}
              </button>
              <CategoryName
                key={`${cat.id}:${cat.displayName}`}
                name={cat.displayName}
                muted={!cat.active}
                onRename={(name) => run(() => updateCat.mutateAsync({ id: cat.id, displayName: name }))}
              />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {cat.subtypes.filter((s) => s.active).length} live
                {cat.subtypes.some((s) => !s.active) ? ` · ${cat.subtypes.filter((s) => !s.active).length} hidden` : ''}
              </span>
              <span style={{ flex: 1 }} />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={cat.active}
                  onChange={(e) => {
                    if (!e.target.checked && !confirm(`Hide “${cat.displayName}” everywhere? Its deals stay live but the chip disappears from all pickers and filters.`)) return;
                    void run(() => updateCat.mutateAsync({ id: cat.id, active: e.target.checked }));
                  }}
                />
                Visible
              </label>
              <button onClick={() => { setEditing(`new:${cat.id}`); setOpenCats((p) => new Set(p).add(cat.id)); }} style={primaryBtnSm}>
                + Add treatment
              </button>
            </div>

            {/* Add form */}
            {editing === `new:${cat.id}` ? (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                <SubtypeForm
                  busy={createSub.isPending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(d) => run(async () => {
                    await createSub.mutateAsync({ categoryId: cat.id, ...d });
                    setEditing(null);
                  })}
                />
              </div>
            ) : null}

            {/* Treatments */}
            {isOpen(cat.id) ? (
              cat.subtypes.length === 0 ? (
                <div style={{ padding: '14px', color: 'var(--text-tertiary)', fontSize: 13, borderTop: '1px solid var(--border-subtle)' }}>
                  {f ? 'No matches in this category.' : 'No treatments yet — add the first one.'}
                </div>
              ) : (
                cat.subtypes.map((s, i) => (
                  <div key={s.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveSub(cat, i, -1)} disabled={i === 0 || reorderSubs.isPending || f.length > 0} style={arrowBtn} aria-label="Move up">↑</button>
                        <button onClick={() => moveSub(cat, i, 1)} disabled={i === cat.subtypes.length - 1 || reorderSubs.isPending || f.length > 0} style={arrowBtn} aria-label="Move down">↓</button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: s.active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {s.displayName}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                          {s.unitLabel ? `per ${s.unitLabel} · ` : ''}{s.dealCount} deal{s.dealCount === 1 ? '' : 's'}
                          {!s.active ? ' · hidden' : ''}
                        </span>
                      </div>
                      <button onClick={() => setEditing(editing === s.id ? null : s.id)} style={linkBtn}>
                        {editing === s.id ? 'Close' : 'Edit'}
                      </button>
                      {s.active ? (
                        <button onClick={() => void run(() => updateSub.mutateAsync({ id: s.id, active: false }))} style={{ ...linkBtn, color: 'var(--text-tertiary)' }}>
                          Hide
                        </button>
                      ) : (
                        <>
                          <button onClick={() => void run(() => updateSub.mutateAsync({ id: s.id, active: true }))} style={linkBtn}>
                            Restore
                          </button>
                          {s.dealCount === 0 ? (
                            <button
                              onClick={() => { if (confirm(`Permanently delete “${s.displayName}”?`)) void run(() => deleteSub.mutateAsync({ id: s.id })); }}
                              style={{ ...linkBtn, color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                    {editing === s.id ? (
                      <div style={{ padding: '0 14px 12px 48px' }}>
                        <SubtypeForm
                          busy={updateSub.isPending}
                          initial={{ displayName: s.displayName, unitLabel: s.unitLabel, helperText: s.helperText }}
                          onCancel={() => setEditing(null)}
                          onSubmit={(d) => run(async () => {
                            await updateSub.mutateAsync({ id: s.id, ...d });
                            setEditing(null);
                          })}
                        />
                      </div>
                    ) : null}
                  </div>
                ))
              )
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

/** Category title — click to rename inline. */
function CategoryName({ name, muted, onRename }: { name: string; muted: boolean; onRename: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Click to rename"
        style={{ ...linkBtn, fontWeight: 700, fontSize: 16, color: muted ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
      >
        {name}{muted ? ' (hidden)' : ''}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setValue(name);
  };
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(name); setEditing(false); } }}
      maxLength={60}
      style={{ ...textInput, width: 240, fontWeight: 700 }}
    />
  );
}

interface SubtypeDraft { displayName: string; unitLabel: string | null; helperText: string | null }

function SubtypeForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: SubtypeDraft;
  busy: boolean;
  onSubmit: (draft: SubtypeDraft) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [unitLabel, setUnitLabel] = useState(initial?.unitLabel ?? '');
  const [helperText, setHelperText] = useState(initial?.helperText ?? '');
  const canSave = displayName.trim().length >= 2 && !busy;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--surface-elevated)' }}>
      <div style={{ flex: '2 1 220px' }}>
        <label style={fieldLabel}>Treatment name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Hydrafacial Deluxe" maxLength={80} style={textInput} />
      </div>
      <div style={{ flex: '1 1 120px' }}>
        <label style={fieldLabel}>Unit (optional)</label>
        <input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="session / units / syringe" maxLength={24} style={textInput} />
      </div>
      <div style={{ flex: '2 1 200px' }}>
        <label style={fieldLabel}>Helper text (optional — shows in the deal form)</label>
        <input value={helperText} onChange={(e) => setHelperText(e.target.value)} maxLength={200} style={textInput} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={!canSave}
          onClick={() => onSubmit({ displayName: displayName.trim(), unitLabel: unitLabel.trim() || null, helperText: helperText.trim() || null })}
          style={{ ...primaryBtnSm, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} style={secondaryBtnSm}>Cancel</button>
      </div>
    </div>
  );
}

const tableShell: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  background: 'var(--surface-elevated)',
};

const primaryBtnSm: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 8,
  border: 'none', background: 'var(--brand-500)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
};

const secondaryBtnSm: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer',
};

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--brand-600)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0,
};

const arrowBtn: React.CSSProperties = {
  width: 22, height: 18, lineHeight: '16px', fontSize: 11, borderRadius: 5,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0,
};

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6,
};

const textInput: React.CSSProperties = {
  width: '100%', fontSize: 14, padding: '8px 11px', borderRadius: 8,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
};
