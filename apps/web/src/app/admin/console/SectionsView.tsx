'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

/**
 * Discover editorial sections (GLO-27) — the merchandising layer for the home
 * (All) feed. Each section is a warm tagline (+ optional typed description)
 * that REPLACES the dry category noun on a rail, pooling deals from whole
 * categories AND/OR specific treatments — so a rail can be as broad as "all of
 * Skin" or as pointed as just Liquid Rhinoplasty. Authored, reordered, and
 * toggled here; the DB is the source of truth (no code release to change
 * copy). When no section is active, the consumer feed falls back to one rail
 * per category — so it's safe to have zero, and safe to draft with `active`
 * off.
 */
export function SectionsView() {
  const utils = trpc.useUtils();
  const sectionsQ = trpc.admin.listDiscoverSections.useQuery();
  const categoriesQ = trpc.categories.list.useQuery();

  const create = trpc.admin.createDiscoverSection.useMutation();
  const update = trpc.admin.updateDiscoverSection.useMutation();
  const remove = trpc.admin.deleteDiscoverSection.useMutation();
  const reorder = trpc.admin.reorderDiscoverSections.useMutation();

  // null = nothing open; 'new' = the create form; a section id = editing it.
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const refresh = () => utils.admin.listDiscoverSections.invalidate();
  const sections = sectionsQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const catName = (id: string) => categories.find((c) => c.id === id)?.displayName ?? '—';
  const subName = (id: string) => {
    for (const c of categories) {
      const s = c.subtypes.find((s) => s.id === id);
      if (s) return s.displayName;
    }
    return '—';
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    const ids = sections.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    await reorder.mutateAsync({ orderedIds: ids });
    await refresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Discover sections</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4, maxWidth: 620 }}>
            Cute, benefit-led taglines that replace the category name on the home feed — each one can
            pool whole categories, specific treatments (e.g. just Liquid Rhinoplasty), or a mix, with an
            optional description under the heading. Reorder to set the order on the app. With none
            active, the feed shows one rail per category automatically.
          </p>
        </div>
        {editing !== 'new' ? (
          <button onClick={() => setEditing('new')} style={primaryBtn}>+ New section</button>
        ) : null}
      </div>

      {editing === 'new' ? (
        <SectionForm
          categories={categories}
          busy={create.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={async (draft) => {
            await create.mutateAsync(draft);
            await refresh();
            setEditing(null);
          }}
        />
      ) : null}

      <div style={tableShell}>
        {sectionsQ.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : sections.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>
            No sections yet. The feed is showing one rail per category. Add one to take over the home feed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sections.map((s, i) => (
              <div key={s.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                  {/* Reorder */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} style={arrowBtn} aria-label="Move up">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === sections.length - 1 || reorder.isPending} style={arrowBtn} aria-label="Move down">↓</button>
                  </div>

                  {/* Thumb */}
                  <div style={{ width: 56, height: 44, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-secondary)', flexShrink: 0 }}>
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: s.active ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {s.tagline}{!s.active ? ' · (hidden)' : ''}
                    </div>
                    {s.description ? (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.description}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {s.categoryIds.length || s.subtypeIds.length
                        ? [...s.categoryIds.map(catName), ...s.subtypeIds.map((id) => `⚲ ${subName(id)}`)].join(' · ')
                        : 'No categories or treatments — won’t show'}
                    </div>
                  </div>

                  {/* Actions */}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={async (e) => { await update.mutateAsync({ id: s.id, active: e.target.checked }); await refresh(); }}
                    />
                    Active
                  </label>
                  <button onClick={() => setEditing(editing === s.id ? null : s.id)} style={linkBtn}>
                    {editing === s.id ? 'Close' : 'Edit'}
                  </button>
                  <button
                    onClick={async () => { if (confirm(`Delete “${s.tagline}”?`)) { await remove.mutateAsync({ id: s.id }); await refresh(); } }}
                    style={{ ...linkBtn, color: 'var(--error)' }}
                  >
                    Delete
                  </button>
                </div>

                {editing === s.id ? (
                  <div style={{ padding: '0 14px 14px' }}>
                    <SectionForm
                      categories={categories}
                      busy={update.isPending}
                      initial={{ tagline: s.tagline, description: s.description, categoryIds: s.categoryIds, subtypeIds: s.subtypeIds, imageUrl: s.imageUrl }}
                      onCancel={() => setEditing(null)}
                      onSubmit={async (draft) => {
                        await update.mutateAsync({ id: s.id, ...draft });
                        await refresh();
                        setEditing(null);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Category { id: string; displayName: string; subtypes: { id: string; displayName: string }[] }
interface Draft { tagline: string; description: string | null; categoryIds: string[]; subtypeIds: string[]; imageUrl: string | null }

function SectionForm({
  categories,
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  initial?: Draft;
  busy: boolean;
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const sign = trpc.admin.signDiscoverSectionUpload.useMutation();
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [subtypeIds, setSubtypeIds] = useState<string[]>(initial?.subtypeIds ?? []);
  const [treatmentQuery, setTreatmentQuery] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleCat = (id: string) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  const toggleSub = (id: string) =>
    setSubtypeIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  // Flat treatment list for the picker; filtered by the search box. Selected
  // ones always show (so they're removable even when they don't match the query).
  const allTreatments = categories.flatMap((c) =>
    c.subtypes.map((s) => ({ id: s.id, name: s.displayName, cat: c.displayName })),
  );
  const tq = treatmentQuery.trim().toLowerCase();
  const treatmentMatches = tq
    ? allTreatments.filter((t) => t.name.toLowerCase().includes(tq) || t.cat.toLowerCase().includes(tq)).slice(0, 12)
    : [];
  const selectedTreatments = allTreatments.filter((t) => subtypeIds.includes(t.id));

  const onPickImage = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const signed = await sign.mutateAsync({ fileExt: ext });
      const res = await fetch(signed.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setImageUrl(signed.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const canSave = tagline.trim().length > 0 && (categoryIds.length > 0 || subtypeIds.length > 0) && !busy && !uploading;

  return (
    <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--surface-elevated)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={fieldLabel}>Tagline (shows on the rail — the category name does not)</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Find fillers & Botox to boost your glow"
          maxLength={120}
          style={textInput}
        />
      </div>

      <div>
        <label style={fieldLabel}>Description (optional — shows under the tagline on the rail)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Liquid nose jobs reshape in 15 minutes — no surgery, no downtime."
          maxLength={240}
          rows={2}
          style={{ ...textInput, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div>
        <label style={fieldLabel}>Categories to pool ({categoryIds.length} selected)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => {
            const on = categoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCat(c.id)}
                style={{
                  fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  border: on ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
                  background: on ? 'var(--brand-50)' : 'var(--surface-elevated)',
                  color: on ? 'var(--brand-700)' : 'var(--text-secondary)',
                }}
              >
                {on ? '✓ ' : ''}{c.displayName}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={fieldLabel}>
          Target specific treatments (optional — {subtypeIds.length} selected). The rail pools these ON TOP of any
          categories above; pick only treatments to make a single-treatment rail (e.g. just Liquid Rhinoplasty).
        </label>
        {selectedTreatments.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {selectedTreatments.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleSub(t.id)}
                title={`${t.cat} — click to remove`}
                style={{
                  fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  border: '1px solid var(--brand-500)', background: 'var(--brand-50)', color: 'var(--brand-700)',
                }}
              >
                ✓ {t.name} ✕
              </button>
            ))}
          </div>
        ) : null}
        <input
          value={treatmentQuery}
          onChange={(e) => setTreatmentQuery(e.target.value)}
          placeholder="Type to find a treatment… (e.g. rhinoplasty)"
          style={textInput}
        />
        {treatmentMatches.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {treatmentMatches.map((t) => {
              const on = subtypeIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleSub(t.id)}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    border: on ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
                    background: on ? 'var(--brand-50)' : 'var(--surface-elevated)',
                    color: on ? 'var(--brand-700)' : 'var(--text-secondary)',
                  }}
                >
                  {on ? '✓ ' : ''}{t.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {t.cat}</span>
                </button>
              );
            })}
          </div>
        ) : tq ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>No treatments match “{treatmentQuery}”.</div>
        ) : null}
      </div>

      <div>
        <label style={fieldLabel}>Tile image (optional — falls back to the first category’s art / a deal photo)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 72, height: 56, borderRadius: 8, overflow: 'hidden', background: 'var(--surface-secondary)', flexShrink: 0 }}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
          </div>
          <label style={{ ...secondaryBtn, cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : imageUrl ? 'Replace' : 'Upload'}
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickImage(f); }} />
          </label>
          {imageUrl ? (
            <button type="button" onClick={() => setImageUrl(null)} style={linkBtn}>Remove</button>
          ) : null}
        </div>
      </div>

      {err ? <div style={{ color: 'var(--error)', fontSize: 13 }}>{err}</div> : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          disabled={!canSave}
          onClick={() => void onSubmit({ tagline: tagline.trim(), description: description.trim() || null, categoryIds, subtypeIds, imageUrl })}
          style={{ ...primaryBtn, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}
        >
          {busy ? 'Saving…' : 'Save section'}
        </button>
        <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
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

const primaryBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 8,
  border: 'none', background: 'var(--brand-500)', color: '#fff', cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
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
  width: '100%', fontSize: 14, padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)',
};
