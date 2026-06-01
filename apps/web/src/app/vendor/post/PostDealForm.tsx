'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button, Card, Field, TextInput } from '../../../components/ui';
import { Wordmark } from '../../../components/Wordmark';
import { trpc } from '../../../lib/trpc';
import { AMENITY_LIST } from './amenities';
import { DealPreview } from './DealPreview';
import { PhotoUploader } from './PhotoUploader';
import { RedemptionLocation, type RedemptionValue } from './RedemptionLocation';
import { VariantsEditor, type VariantDraft } from './VariantsEditor';
import { VideoUploader, type DealVideoDraft } from './VideoUploader';

/**
 * Mode lets the same form serve two flows:
 *  - vendor: the logged-in vendor posts/edits their own deal.
 *  - admin:  the founder posts a deal on behalf of a specific vendor.
 * Everything renders identically (incl. the live iPhone preview); only the
 * data source (vendor name) and the submit target differ.
 */
export type PostDealMode =
  | { kind: 'vendor' }
  | { kind: 'admin'; vendorId: string; vendorName: string };

export function PostDealForm({ mode }: { mode: PostDealMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = mode.kind === 'vendor' ? searchParams.get('edit') : null;
  const isAdmin = mode.kind === 'admin';
  const categoriesQuery = trpc.categories.list.useQuery();
  const meQuery = trpc.vendor.me.useQuery(undefined, { enabled: !isAdmin });
  const amenitiesQuery = trpc.vendor.amenities.useQuery(undefined, { enabled: !isAdmin });
  const editQuery = trpc.vendor.getDeal.useQuery(
    { dealId: editId ?? '' },
    { enabled: !!editId },
  );
  const categories = categoriesQuery.data ?? [];

  const vendorName = isAdmin ? mode.vendorName : meQuery.data?.businessName ?? 'Your spa';

  // 1-2 categories per listing. categoryIds[0] = primary, categoryIds[1] = secondary.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [whatsIncluded, setWhatsIncluded] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videos, setVideos] = useState<DealVideoDraft[]>([]);
  const [redemption, setRedemption] = useState<RedemptionValue>({ address: null, lat: null, lng: null });
  const [startsAt, setStartsAt] = useState(''); // datetime-local; empty = start now
  const [expiresAt, setExpiresAt] = useState(''); // datetime-local; required
  const [perCustomerLimit, setPerCustomerLimit] = useState(1);
  const [codeValidityDays, setCodeValidityDays] = useState(7);
  const [variants, setVariants] = useState<VariantDraft[]>([
    { label: '', unitCount: '', originalPrice: '', dealPrice: '', spotsTotal: '' },
  ]);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The specific treatment (Botox/Dysport…). Auto-detected from the title; the
  // vendor always sees it and can change/clear it. `touched` stops auto-detect
  // from overriding a manual (or hydrated) choice.
  const [subtypeId, setSubtypeId] = useState<string | null>(null);
  const [subtypeTouched, setSubtypeTouched] = useState(false);
  const [pickingSubtype, setPickingSubtype] = useState(false);

  // Default expiry to 14 days out for new deals.
  useEffect(() => {
    if (!editId && !expiresAt) {
      setExpiresAt(toLocalInput(new Date(Date.now() + 14 * 86400_000)));
    }
  }, [editId, expiresAt]);

  // Hydrate the form when editing an existing deal.
  useEffect(() => {
    const d = editQuery.data;
    if (!d) return;
    setCategoryIds(d.categoryIds ?? [d.categoryId]);
    // Preserve an existing treatment; if the deal had none, leave it open so
    // detection can suggest one as they edit.
    setSubtypeId(d.subtypeId ?? null);
    setSubtypeTouched(d.subtypeId != null);
    setTitle(d.title);
    setDescription(d.description);
    setWhatsIncluded((d.whatsIncluded ?? []).join('\n'));
    setRestrictions((d.restrictions ?? []).join('\n'));
    setPhotoUrls(d.photoUrls ?? []);
    setVideos((d.videos ?? []).map((v) => ({ ...v })));
    setRedemption({ address: d.redemptionAddress, lat: d.redemptionLat, lng: d.redemptionLng });
    setStartsAt(toLocalInput(new Date(d.startsAt)));
    setExpiresAt(toLocalInput(new Date(d.expiresAt)));
    setPerCustomerLimit(d.perCustomerLimit);
    setCodeValidityDays(d.codeValidityDays);
    setEditStatus(d.status);
    setVariants(
      d.variants.map((v) => ({
        label: v.label,
        unitCount: v.unitCount != null ? String(v.unitCount) : '',
        originalPrice: (v.originalPriceCents / 100).toString(),
        dealPrice: (v.dealPriceCents / 100).toString(),
        spotsTotal: v.spotsTotal != null ? String(v.spotsTotal) : '',
      })),
    );
  }, [editQuery.data]);

  const primaryCategory = useMemo(
    () => categories.find((c) => c.id === categoryIds[0]),
    [categories, categoryIds],
  );
  const selectedCategories = useMemo(
    () => categoryIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as typeof categories,
    [categories, categoryIds],
  );

  // Treatments available under the primary category — the scoped picker list
  // (so the vendor sees ~5-12 chips for their category, never all 42).
  const subtypeOptions = primaryCategory?.subtypes ?? [];
  const selectedSubtype = useMemo(
    () => subtypeOptions.find((s) => s.id === subtypeId) ?? null,
    [subtypeOptions, subtypeId],
  );

  // Debounce the title so the detector only fires when typing settles.
  const [debouncedTitle, setDebouncedTitle] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(title.trim()), 350);
    return () => clearTimeout(t);
  }, [title]);

  const detectQuery = trpc.deals.detectSubtype.useQuery(
    { title: debouncedTitle, categorySlug: primaryCategory?.slug },
    { enabled: debouncedTitle.length >= 3 && !!primaryCategory },
  );
  const detected = detectQuery.data ?? null;

  // Auto-apply only a HIGH-confidence (brand-name) detection, and only when the
  // vendor hasn't set the treatment themselves. They always see the resulting
  // chip and can change or clear it — this is a head start, never a lock-in.
  useEffect(() => {
    if (subtypeTouched || subtypeId) return;
    if (detected?.confidence === 'high') {
      const match = subtypeOptions.find((s) => s.slug === detected.subtypeSlug);
      if (match) setSubtypeId(match.id);
    }
  }, [detected, subtypeTouched, subtypeId, subtypeOptions]);

  // If the primary category changes, a subtype from the old category no longer
  // belongs — drop it so we don't post a mismatched treatment.
  useEffect(() => {
    if (subtypeOptions.length > 0 && subtypeId && !subtypeOptions.some((s) => s.id === subtypeId)) {
      setSubtypeId(null);
      setSubtypeTouched(false);
    }
  }, [subtypeOptions, subtypeId]);

  // Helper-disclaimer text — shown for any selected category that hosts a subtype
  // carrying helper_text (currently: Wellness → Medical Weight Mgmt Consult).
  // We show the disclaimer whenever vendors might be tempted to list medication.
  const categoryHelperTexts = useMemo(() => {
    const texts: string[] = [];
    for (const cat of selectedCategories) {
      for (const sub of cat.subtypes) {
        if (sub.helperText && !texts.includes(sub.helperText)) texts.push(sub.helperText);
      }
    }
    return texts;
  }, [selectedCategories]);

  const toggleCategory = (id: string) => {
    setError(null);
    setCategoryIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        setError('You can select up to 2 categories per listing.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const previewData = {
    categoryLabel: primaryCategory?.displayName ?? 'Category',
    subtypeLabel: selectedSubtype?.displayName ?? selectedCategories[1]?.displayName ?? null,
    title,
    description,
    whatsIncluded: splitLines(whatsIncluded),
    restrictions: splitLines(restrictions),
    photoUrls,
    videos,
    variants,
    vendorName,
    amenities: amenitiesQuery.data ?? [],
    redemption: resolveRedemptionForPreview(redemption, meQuery.data?.address ?? null),
  };

  const utils = trpc.useUtils();
  const onDone = () => {
    if (isAdmin) {
      void utils.admin.vendorRoster.invalidate();
      router.push('/admin');
    } else {
      void utils.vendor.listDeals.invalidate();
      router.push('/vendor');
    }
  };
  const createDeal = trpc.vendor.createDeal.useMutation({ onSuccess: onDone, onError: (e) => setError(e.message) });
  const updateDeal = trpc.vendor.updateDeal.useMutation({ onSuccess: onDone, onError: (e) => setError(e.message) });
  const postOnBehalf = trpc.admin.postDealOnBehalf.useMutation({ onSuccess: onDone, onError: (e) => setError(e.message) });
  const pending = createDeal.isPending || updateDeal.isPending || postOnBehalf.isPending;

  const submit = (asDraft: boolean) => {
    setError(null);
    const cleanVariants = variants
      .filter((v) => v.label && v.originalPrice && v.dealPrice)
      .map((v) => ({
        label: v.label,
        unitCount: v.unitCount ? Number(v.unitCount) : null,
        unitLabel: primaryCategory?.isUnitBased ? 'units' : null,
        originalPriceCents: Math.round(Number(v.originalPrice) * 100),
        dealPriceCents: Math.round(Number(v.dealPrice) * 100),
        spotsTotal: v.spotsTotal ? Number(v.spotsTotal) : null,
      }));

    if (categoryIds.length === 0) return setError('Pick a category.');
    if (categoryIds.length > 2) return setError('You can select up to 2 categories per listing.');
    if (cleanVariants.length === 0) return setError('Add at least one pricing option.');
    if (!expiresAt) return setError('Set when the deal expires.');

    const payload = {
      categoryIds,
      subtypeId,
      title,
      description,
      whatsIncluded: splitLines(whatsIncluded),
      restrictions: splitLines(restrictions),
      finePrint: null,
      redemptionAddress: redemption.address,
      redemptionLat: redemption.lat,
      redemptionLng: redemption.lng,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      expiresAt: new Date(expiresAt).toISOString(),
      perCustomerLimit,
      codeValidityDays,
      photoUrls,
      videos: videos.map((v) => ({
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        caption: v.caption,
        durationSeconds: v.durationSeconds,
      })),
      variants: cleanVariants,
      asDraft,
    };

    if (isAdmin) {
      postOnBehalf.mutate({
        vendorId: mode.vendorId,
        categoryIds: payload.categoryIds,
        subtypeId: payload.subtypeId,
        title: payload.title,
        description: payload.description,
        whatsIncluded: payload.whatsIncluded,
        restrictions: payload.restrictions,
        finePrint: payload.finePrint,
        redemptionAddress: payload.redemptionAddress,
        redemptionLat: payload.redemptionLat,
        redemptionLng: payload.redemptionLng,
        expiresAt: payload.expiresAt,
        perCustomerLimit: payload.perCustomerLimit,
        codeValidityDays: payload.codeValidityDays,
        photoUrls: payload.photoUrls,
        variants: payload.variants,
      });
      return;
    }
    if (editId) updateDeal.mutate({ dealId: editId, ...payload });
    else createDeal.mutate(payload);
  };

  // Editing a LIVE deal will bounce it back to review — warn the vendor.
  const willResubmit = editId && editStatus === 'active';

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
            <button onClick={() => router.push(isAdmin ? '/admin' : '/vendor')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15 }}>
              Cancel
            </button>
          </div>
        </div>
      </header>

      {/* Split: form column + sticky preview column */}
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 40, padding: '40px 32px', alignItems: 'flex-start' }}>
        <main className="post-form-col" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 style={{ fontSize: 36 }}>{editId ? 'Edit deal' : isAdmin ? `Post a deal for ${vendorName}` : 'Post a deal'}</h1>
        {willResubmit ? (
          <Card style={{ background: 'var(--brand-50)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              This deal is live. Saving changes will send it back for a quick review before it goes live again.
            </p>
          </Card>
        ) : null}

        {/* What is it */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>What&apos;s the treatment?</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            Pick 1–2 categories. The first one is the primary category.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field
              label={`Categories${categoryIds.length > 0 ? ` (${categoryIds.length}/2)` : ''}`}
              hint="Tap to add. First selection = primary."
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((c) => {
                  const idx = categoryIds.indexOf(c.id);
                  const isPrimary = idx === 0;
                  const isSecondary = idx === 1;
                  const isSelected = idx >= 0;
                  const disabled = !isSelected && categoryIds.length >= 2;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      disabled={disabled}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? 'var(--brand-500)' : 'var(--border-default)'}`,
                        background: isSelected ? 'var(--brand-500)' : 'var(--surface-elevated)',
                        color: isSelected ? 'var(--text-inverse)' : 'var(--text-primary)',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.45 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {c.displayName}
                      {isPrimary ? <span style={{ fontSize: 11, opacity: 0.85 }}>· primary</span> : null}
                      {isSecondary ? <span style={{ fontSize: 11, opacity: 0.85 }}>· secondary</span> : null}
                    </button>
                  );
                })}
              </div>
            </Field>

            {categoryHelperTexts.length > 0 ? (
              <div
                style={{
                  background: 'var(--brand-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {categoryHelperTexts.map((t) => (
                  <div key={t}>{t}</div>
                ))}
              </div>
            ) : null}

            <Field label="Deal title">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Botox — first-timer special" />
            </Field>

            {/* Treatment — auto-detected from the title, vendor-confirmable. Only
                shows once a primary category is chosen; scoped to that category's
                treatments so it's a short list, never the full taxonomy. */}
            {primaryCategory && subtypeOptions.length > 0 ? (
              <Field label="Treatment" hint="Auto-detected from your title. Optional — change or clear anytime.">
                {selectedSubtype && !pickingSubtype ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: 'var(--brand-500)', color: 'var(--text-inverse)', fontSize: 14, fontWeight: 600 }}>
                      ✓ {selectedSubtype.displayName}
                    </span>
                    <button type="button" onClick={() => setPickingSubtype(true)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Change</button>
                    <button type="button" onClick={() => { setSubtypeId(null); setSubtypeTouched(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 13, cursor: 'pointer' }}>Clear</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!selectedSubtype && detected?.confidence === 'medium' && subtypeOptions.some((s) => s.slug === detected.subtypeSlug) ? (
                      <button
                        type="button"
                        onClick={() => {
                          const m = subtypeOptions.find((s) => s.slug === detected.subtypeSlug);
                          if (m) { setSubtypeId(m.id); setSubtypeTouched(true); setPickingSubtype(false); }
                        }}
                        style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--brand-50)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
                      >
                        Looks like <strong>{detected.displayName}</strong> — tap to use it
                      </button>
                    ) : null}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {subtypeOptions.map((s) => {
                        const sel = s.id === subtypeId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSubtypeId(s.id); setSubtypeTouched(true); setPickingSubtype(false); }}
                            style={{ padding: '7px 13px', borderRadius: 999, border: `1px solid ${sel ? 'var(--brand-500)' : 'var(--border-default)'}`, background: sel ? 'var(--brand-500)' : 'var(--surface-elevated)', color: sel ? 'var(--text-inverse)' : 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {s.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Field>
            ) : null}

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
            unitBased={primaryCategory?.isUnitBased ?? false}
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

        {/* Videos — render in the app's "Inside [vendor]" reel */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Videos</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            Short clips of your space or treatments. Shown in the &ldquo;Inside {previewData.vendorName}&rdquo; reel.
          </p>
          <VideoUploader videos={videos} onChange={setVideos} />
        </Card>

        {/* Amenities (business-level, set once). Hidden in admin/on-behalf mode
            — those are part of the spa's own profile, not set per deal here. */}
        {!isAdmin ? (
          <Card>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Amenities</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
              What your spa offers — shown on every deal. Set once for your business.
            </p>
            <AmenityPicker />
          </Card>
        ) : null}

        {/* Redemption location */}
        <Card>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Where do they redeem?</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 16 }}>
            Customers see this address and a map on the deal. Defaults to your business address.
          </p>
          <RedemptionLocation
            value={redemption}
            onChange={setRedemption}
            businessAddress={meQuery.data?.address ?? null}
          />
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
              <Field label="Goes live" hint="Leave blank to start now">
                <TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </Field>
              <Field label="Expires" hint="Deal auto-hides after this">
                <TextInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </Field>
            </div>
            <div className="address-row">
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

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => router.push(isAdmin ? '/admin' : '/vendor')}>Cancel</Button>
          {!isAdmin ? (
            <Button variant="secondary" onClick={() => submit(true)} disabled={pending}>
              {pending ? 'Saving…' : 'Save as draft'}
            </Button>
          ) : null}
          <Button onClick={() => submit(false)} disabled={pending}>
            {pending
              ? 'Saving…'
              : isAdmin
                ? 'Post deal (live now)'
                : willResubmit
                  ? 'Save & resubmit'
                  : editId
                    ? 'Submit for review'
                    : 'Publish deal'}
          </Button>
        </div>

        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', paddingBottom: 40 }}>
          {isAdmin
            ? 'Goes live immediately. They get paid once they connect Stripe — after their first sale.'
            : 'Deals are reviewed before going live (usually within a few hours). Drafts stay private until you submit them.'}
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

/** Resolves the redemption point for the preview: custom pick, else business address. */
function resolveRedemptionForPreview(
  redemption: RedemptionValue,
  business: { line1: string; city: string; region: string; postalCode: string; latitude: number | null; longitude: number | null } | null,
): { address: string | null; lat: number | null; lng: number | null } {
  if (redemption.lat != null && redemption.lng != null) {
    return { address: redemption.address, lat: redemption.lat, lng: redemption.lng };
  }
  if (business) {
    return {
      address: [business.line1, business.city, business.region, business.postalCode].filter(Boolean).join(', '),
      lat: business.latitude,
      lng: business.longitude,
    };
  }
  return { address: null, lat: null, lng: null };
}

/** Formats a Date for an <input type="datetime-local"> value (local time, no TZ). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

