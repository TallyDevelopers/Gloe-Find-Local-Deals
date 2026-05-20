'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button, Card, Field, TextInput } from '../../../components/ui';
import { Wordmark } from '../../../components/Wordmark';
import { trpc } from '../../../lib/trpc';
import { AMENITY_LIST } from './amenities';
import { DealPreview } from './DealPreview';
import { PhotoUploader } from './PhotoUploader';
import { VariantsEditor, type VariantDraft } from './VariantsEditor';

export default function PostDealPage() {
  const router = useRouter();
  const categoriesQuery = trpc.categories.list.useQuery();
  const meQuery = trpc.vendor.me.useQuery();
  const amenitiesQuery = trpc.vendor.amenities.useQuery();
  const categories = categoriesQuery.data ?? [];

  const [categoryId, setCategoryId] = useState('');
  const [subtypeId, setSubtypeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [whatsIncluded, setWhatsIncluded] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [perCustomerLimit, setPerCustomerLimit] = useState(1);
  const [codeValidityDays, setCodeValidityDays] = useState(7);
  const [variants, setVariants] = useState<VariantDraft[]>([
    { label: '', unitCount: '', originalPrice: '', dealPrice: '', spotsTotal: '' },
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );
  const selectedSubtype = useMemo(
    () => selectedCategory?.subtypes.find((s) => s.id === subtypeId),
    [selectedCategory, subtypeId],
  );

  const previewData = {
    categoryLabel: selectedCategory?.displayName ?? 'Category',
    subtypeLabel: selectedSubtype?.displayName ?? null,
    title,
    description,
    whatsIncluded: splitLines(whatsIncluded),
    restrictions: splitLines(restrictions),
    photoUrls,
    variants,
    vendorName: meQuery.data?.businessName ?? 'Your spa',
    amenities: amenitiesQuery.data ?? [],
  };

  const createDeal = trpc.vendor.createDeal.useMutation({
    onSuccess: () => router.push('/vendor'),
    onError: (e) => setError(e.message),
  });

  const handlePublish = () => {
    setError(null);
    const expiresAt = new Date(Date.now() + expiresInDays * 86400_000).toISOString();
    const cleanVariants = variants
      .filter((v) => v.label && v.originalPrice && v.dealPrice)
      .map((v) => ({
        label: v.label,
        unitCount: v.unitCount ? Number(v.unitCount) : null,
        unitLabel: selectedCategory?.isUnitBased ? unitLabelFor(selectedCategory, subtypeId) : null,
        originalPriceCents: Math.round(Number(v.originalPrice) * 100),
        dealPriceCents: Math.round(Number(v.dealPrice) * 100),
        spotsTotal: v.spotsTotal ? Number(v.spotsTotal) : null,
      }));

    if (!categoryId) return setError('Pick a category.');
    if (cleanVariants.length === 0) return setError('Add at least one pricing option.');

    createDeal.mutate({
      categoryId,
      subtypeId: subtypeId || null,
      title,
      description,
      whatsIncluded: splitLines(whatsIncluded),
      restrictions: splitLines(restrictions),
      finePrint: null,
      expiresAt,
      perCustomerLimit,
      codeValidityDays,
      photoUrls,
      variants: cleanVariants,
    });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Wordmark size={22} tone="gold" />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Mobile-only preview toggle */}
            <button
              className="preview-toggle"
              onClick={() => setShowPreview(true)}
              style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 999, padding: '6px 14px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}
            >
              Preview
            </button>
            <button onClick={() => router.push('/vendor')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15 }}>
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Split: form column + sticky preview column */}
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 40, padding: '40px 32px', alignItems: 'flex-start' }}>
        <main className="post-form-col" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 style={{ fontSize: 36 }}>Post a deal</h1>

        {/* What is it */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>What&apos;s the treatment?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="address-row">
              <Field label="Category">
                <select
                  value={categoryId}
                  onChange={(e) => { setCategoryId(e.target.value); setSubtypeId(''); }}
                  style={selectStyle}
                >
                  <option value="">Choose…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Type (optional)">
                <select
                  value={subtypeId}
                  onChange={(e) => setSubtypeId(e.target.value)}
                  disabled={!selectedCategory}
                  style={selectStyle}
                >
                  <option value="">Any / general</option>
                  {selectedCategory?.subtypes.map((s) => (
                    <option key={s.id} value={s.id}>{s.displayName}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Deal title">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Botox — first-timer special" />
            </Field>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the treatment includes, who it's for, what to expect…"
                rows={4}
                style={{ ...selectStyle, resize: 'vertical' as const, padding: '12px 16px' }}
              />
            </Field>
          </div>
        </Card>

        {/* Pricing / variants */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Pricing options</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            Add one or more — e.g. 20 units / 40 units, or single session / 3-pack.
          </p>
          <VariantsEditor
            variants={variants}
            onChange={setVariants}
            unitBased={selectedCategory?.isUnitBased ?? false}
          />
        </Card>

        {/* Photos */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Photos</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            First photo is the cover. Use your own treatment-room or results photos.
          </p>
          <PhotoUploader urls={photoUrls} onChange={setPhotoUrls} />
        </Card>

        {/* Amenities (business-level, set once) */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Amenities</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            What your spa offers — shown on every deal. Set once for your business.
          </p>
          <AmenityPicker />
        </Card>

        {/* Details */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="What's included" hint="One per line">
              <textarea value={whatsIncluded} onChange={(e) => setWhatsIncluded(e.target.value)} rows={3} placeholder={'Botox injections\nFree consultation\n2-week follow-up'} style={{ ...selectStyle, resize: 'vertical' as const, padding: '12px 16px' }} />
            </Field>
            <Field label="Restrictions / fine print" hint="One per line">
              <textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} rows={3} placeholder={'New clients only\nCannot combine with other offers'} style={{ ...selectStyle, resize: 'vertical' as const, padding: '12px 16px' }} />
            </Field>
            <div className="address-row">
              <Field label="Deal expires in (days)">
                <TextInput type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} />
              </Field>
              <Field label="Per-customer limit">
                <TextInput type="number" value={perCustomerLimit} onChange={(e) => setPerCustomerLimit(Number(e.target.value))} />
              </Field>
              <Field label="Code valid (days)">
                <TextInput type="number" value={codeValidityDays} onChange={(e) => setCodeValidityDays(Number(e.target.value))} />
              </Field>
            </div>
          </div>
        </Card>

        {error ? <p style={{ color: 'var(--error)', fontSize: 15 }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => router.push('/vendor')}>Cancel</Button>
          <Button onClick={handlePublish} disabled={createDeal.isPending}>
            {createDeal.isPending ? 'Publishing…' : 'Publish deal'}
          </Button>
        </div>

        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', paddingBottom: 40 }}>
          New deals are reviewed before going live (usually within a few hours).
        </p>
        </main>

        {/* Sticky live preview (desktop) */}
        <aside
          className="post-preview-col"
          style={{ position: 'sticky', top: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em' }}>
            LIVE PREVIEW
          </span>
          <DealPreview data={previewData} />
        </aside>
      </div>

      {/* Mobile fullscreen preview overlay */}
      {showPreview ? (
        <div
          className="preview-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(43,32,25,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
          }}
        >
          <DealPreview data={previewData} />
          <Button onClick={() => setShowPreview(false)}>Close preview</Button>
        </div>
      ) : null}
    </div>
  );
}

function AmenityPicker() {
  const utils = trpc.useUtils();
  const amenitiesQuery = trpc.vendor.amenities.useQuery();
  const selected = new Set(amenitiesQuery.data ?? []);
  const update = trpc.vendor.updateAmenities.useMutation({
    onSuccess: () => utils.vendor.amenities.invalidate(),
  });

  const toggle = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    update.mutate({ amenities: [...next] });
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {AMENITY_LIST.map((a) => {
        const on = selected.has(a.slug);
        return (
          <button
            key={a.slug}
            type="button"
            onClick={() => toggle(a.slug)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: `1px solid ${on ? 'var(--brand-500)' : 'var(--border-default)'}`,
              background: on ? 'var(--brand-500)' : 'var(--surface-elevated)',
              color: on ? 'var(--text-inverse)' : 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <span>{a.icon}</span> {a.label}
          </button>
        );
      })}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 16,
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
  width: '100%',
  fontFamily: 'var(--font-body)',
};

function splitLines(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

function unitLabelFor(
  category: { subtypes: { id: string; unitLabel: string | null }[] },
  subtypeId: string,
): string | null {
  return category.subtypes.find((s) => s.id === subtypeId)?.unitLabel ?? 'units';
}
