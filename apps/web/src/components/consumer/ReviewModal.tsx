'use client';

import { useEffect, useRef, useState } from 'react';

import { Star, X } from './icons';
import { trpc } from '../../lib/trpc';

const MAX_PHOTOS = 3;
const MAX_BODY = 2000;

/**
 * Web review modal — the desktop/consumer-web twin of the mobile ReviewSheet.
 * Star rating + optional text + up to 3 photos. Photos upload straight to
 * Supabase via a signed URL (reviews.signPhotoUpload), then reviews.create
 * stores the final set. Submit is idempotent on the server (upsert by claim_id),
 * so editing an existing review just re-saves. Mirrors ReviewSheet.tsx so the
 * two platforms behave identically.
 */
export function ReviewModal({
  claimId,
  vendorName,
  onClose,
  onSaved,
}: {
  /** null = closed. */
  claimId: string | null;
  vendorName: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const open = claimId !== null;
  const existing = trpc.reviews.byClaim.useQuery(
    { claimId: claimId ?? '' },
    { enabled: open },
  );
  const sign = trpc.reviews.signPhotoUpload.useMutation();
  const create = trpc.reviews.create.useMutation();
  const utils = trpc.useUtils();

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const seedKey = useRef<string | null>(null);

  // Seed from an existing review when the modal opens (edit flow).
  useEffect(() => {
    if (!open) {
      seedKey.current = null;
      return;
    }
    const key = `${claimId}:${existing.data?.id ?? ''}`;
    if (seedKey.current === key) return;
    if (existing.data) {
      setRating(existing.data.rating);
      setBody(existing.data.body ?? '');
      setPhotos(existing.data.photoUrls.map((url) => ({ status: 'done', publicUrl: url, previewUrl: url })));
    } else if (existing.data === null) {
      setRating(0);
      setBody('');
      setPhotos([]);
    }
    setError(null);
    seedKey.current = key;
  }, [open, claimId, existing.data]);

  if (!open) return null;

  const isEditing = !!existing.data;
  const uploading = photos.some((p) => p.status === 'uploading');
  const errored = photos.some((p) => p.status === 'error');
  const canSubmit = rating >= 1 && rating <= 5 && !create.isPending && !uploading && !errored;

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0 || files.length === 0) return;
    const chosen = files.slice(0, remaining);

    const slots: PhotoSlot[] = chosen.map((f) => ({
      status: 'uploading',
      previewUrl: URL.createObjectURL(f),
      file: f,
    }));
    setPhotos((prev) => [...prev, ...slots]);
    await Promise.all(slots.map((s) => uploadOne(s)));
  }

  async function uploadOne(slot: PhotoSlot) {
    if (slot.status !== 'uploading') return;
    try {
      const ext = (slot.file.name.split('.').pop() ?? 'jpg').slice(0, 5);
      const signed = await sign.mutateAsync({ fileExt: ext });
      const res = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': slot.file.type || 'image/jpeg' },
        body: slot.file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setPhotos((prev) =>
        prev.map((p) =>
          p.previewUrl === slot.previewUrl
            ? { status: 'done', previewUrl: slot.previewUrl, publicUrl: signed.publicUrl }
            : p,
        ),
      );
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.previewUrl === slot.previewUrl
            ? { status: 'error', previewUrl: slot.previewUrl, file: slot.file }
            : p,
        ),
      );
    }
  }

  function removePhoto(previewUrl: string) {
    setPhotos((prev) => prev.filter((p) => p.previewUrl !== previewUrl));
  }

  async function submit() {
    setError(null);
    if (!canSubmit || claimId === null) return;
    try {
      const photoUrls = photos
        .filter((p): p is PhotoSlotDone => p.status === 'done')
        .map((p) => p.publicUrl);
      await create.mutateAsync({
        claimId,
        rating,
        body: body.trim() ? body.trim() : undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });
      await Promise.all([
        utils.reviews.byClaim.invalidate({ claimId }),
        utils.claims.list.invalidate(),
      ]);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review.');
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(43,32,25,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', padding: 26, boxShadow: '0 24px 60px rgba(43,32,25,0.28)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
          <X size={20} color="var(--text-tertiary)" />
        </button>

        <h2 style={{ fontSize: 23 }}>{isEditing ? 'Edit your review' : 'How was your visit?'}</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{vendorName}</p>

        {/* Stars */}
        <div style={{ display: 'flex', gap: 6, marginTop: 18, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= (hover || rating);
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}
              >
                <Star
                  size={36}
                  color={filled ? 'var(--brand-500)' : 'var(--border-default)'}
                  fill={filled ? 'var(--brand-500)' : 'none'}
                />
              </button>
            );
          })}
        </div>

        {/* Body */}
        <textarea
          placeholder="Add a few words (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_BODY}
          rows={4}
          style={{ width: '100%', marginTop: 18, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-primary)', color: 'var(--text-primary)', fontSize: 15, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
        />

        {/* Photos */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
            Photos (optional · {photos.length}/{MAX_PHOTOS})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {photos.map((p) => (
              <div key={p.previewUrl} style={{ position: 'relative', width: 84, height: 84, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: p.status === 'error' ? '1px solid var(--error, #b24545)' : '1px solid var(--border-subtle)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.status === 'uploading' ? (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>Uploading…</div>
                ) : null}
                {p.status === 'error' ? (
                  <button type="button" onClick={() => uploadOne({ status: 'uploading', previewUrl: p.previewUrl, file: p.file })} style={{ position: 'absolute', inset: 0, background: 'rgba(178,69,69,0.7)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Retry</button>
                ) : null}
                <button type="button" onClick={() => removePhoto(p.previewUrl)} aria-label="Remove photo" style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--text-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: '14px' }}>×</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <button type="button" onClick={() => fileInput.current?.click()} style={{ width: 84, height: 84, borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-default)', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <span style={{ fontSize: 24, lineHeight: '24px' }}>+</span>
                Add
              </button>
            ) : null}
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
        </div>

        {error ? <p style={{ color: 'var(--error, #b24545)', fontSize: 14, marginTop: 12 }}>{error}</p> : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '13px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} style={{ flex: 2, padding: '13px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: canSubmit ? 'var(--brand-500)' : 'var(--border-default)', color: 'var(--text-inverse)', fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default' }}>
            {create.isPending ? 'Saving…' : uploading ? 'Uploading photos…' : isEditing ? 'Update review' : 'Submit review'}
          </button>
        </div>
      </div>
    </div>
  );
}

type PhotoSlot =
  | { status: 'uploading'; previewUrl: string; file: File }
  | { status: 'error'; previewUrl: string; file: File }
  | PhotoSlotDone;

interface PhotoSlotDone {
  status: 'done';
  previewUrl: string; // object URL or remote URL (when seeded from existing review)
  publicUrl: string;
}
