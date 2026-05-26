'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

interface PhotoUploaderProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

// Hard cap on what we'll send to Supabase, in bytes. The bucket itself is set
// to 10 MB; we compress aggressively below this, so anything still over the
// limit after compression is a genuinely huge file the vendor should crop.
const MAX_BYTES = 10 * 1024 * 1024;

// Target dimensions for the compressed output. Anything wider is scaled down,
// preserving aspect ratio. 1920px wide covers retina display at full bleed.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; fileName: string; fileIndex: number; totalFiles: number }
  | { kind: 'compressing'; fileName: string; fileIndex: number; totalFiles: number }
  | { kind: 'uploading'; fileName: string; fileIndex: number; totalFiles: number; percent: number };

/**
 * Uploads images to Supabase Storage via a signed URL issued by our API.
 *
 * Per-file pipeline:
 *   1. Read into an HTMLImageElement (validates it's actually an image)
 *   2. Draw to a canvas at max 1920px wide → JPEG @ 82% quality
 *   3. PUT via XHR (so we can show upload progress)
 *
 * Compression typically takes an 8 MB iPhone photo down to ~500 KB. Skipped
 * for files already under 1 MB (no point compressing twice).
 */
export function PhotoUploader({ urls, onChange }: PhotoUploaderProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const signMutation = trpc.vendor.signPhotoUpload.useMutation();

  const moveItem = (from: number, to: number) => {
    if (from === to) return;
    const next = [...urls];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  };

  const handleDrop = (to: number) => {
    if (dragIndex !== null) moveItem(dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).slice(0, 8 - urls.length);
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        if (!file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" isn't an image. Use JPEG, PNG, WebP, or HEIC.`);
        }

        setPhase({ kind: 'reading', fileName: file.name, fileIndex: i, totalFiles: list.length });
        const compressed = await maybeCompress(file, (next) => setPhase((prev) => prev.kind === 'idle' ? prev : { ...next, fileIndex: i, totalFiles: list.length }));

        if (compressed.size > MAX_BYTES) {
          throw new Error(`"${file.name}" is still ${(compressed.size / 1024 / 1024).toFixed(1)} MB after compression. Crop it down and try again.`);
        }

        const ext = 'jpg'; // Compression normalizes to JPEG.
        const signed = await signMutation.mutateAsync({ fileExt: ext });
        await uploadWithProgress(signed.uploadUrl, compressed, (pct) => {
          setPhase({ kind: 'uploading', fileName: file.name, fileIndex: i, totalFiles: list.length, percent: pct });
        });
        newUrls.push(signed.publicUrl);
      }
      onChange([...urls, ...newUrls]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.';
      setError(msg);
    } finally {
      setPhase({ kind: 'idle' });
    }
  };

  const removeAt = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  const uploading = phase.kind !== 'idle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {urls.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnter={() => setOverIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              cursor: 'grab',
              borderRadius: 'var(--radius-md)',
              outline: overIndex === i && dragIndex !== i ? '2px solid var(--brand-500)' : 'none',
              outlineOffset: 2,
              opacity: dragIndex === i ? 0.4 : 1,
              transition: 'opacity 0.1s',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="deal"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 'var(--radius-md)',
                border: i === 0 ? '2px solid var(--brand-500)' : 'none',
                pointerEvents: 'none',
              }}
            />
            {i === 0 ? (
              <span style={{ position: 'absolute', bottom: 4, left: 4, background: 'var(--brand-500)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>
                COVER
              </span>
            ) : (
              <button
                onClick={() => moveItem(i, 0)}
                title="Make cover"
                style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(43,32,25,0.8)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, border: 'none' }}
              >
                Set cover
              </button>
            )}
            <button
              onClick={() => removeAt(i)}
              style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'var(--text-primary)', color: '#fff', border: 'none', fontSize: 13, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}

        {urls.length < 8 ? (
          <label
            style={{
              width: 96,
              height: 96,
              borderRadius: 'var(--radius-md)',
              border: '2px dashed var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              textAlign: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {uploading ? <UploadProgress phase={phase} /> : '+ Add'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
          JPEG, PNG, WebP, or HEIC. Up to 10 MB per photo — we auto-compress to keep things fast. 8 photos max.
          {urls.length > 1 ? <> · Drag to reorder. The first photo is the cover.</> : null}
        </span>
        {error ? <span style={{ color: 'var(--error)', fontSize: 13 }}>{error}</span> : null}
      </div>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function UploadProgress({ phase }: { phase: Phase }) {
  if (phase.kind === 'idle') return null;
  const label =
    phase.kind === 'reading' ? 'Reading…'
    : phase.kind === 'compressing' ? 'Compressing…'
    : `${phase.percent}%`;
  const pct =
    phase.kind === 'reading' ? 10
    : phase.kind === 'compressing' ? 35
    : 35 + phase.percent * 0.65;
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
        {phase.fileIndex + 1} of {phase.totalFiles}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--surface-secondary)' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: 'var(--brand-500)',
          transition: 'width 120ms linear',
        }} />
      </div>
    </>
  );
}

/**
 * Reads an image File, downscales to MAX_DIMENSION wide if needed, and
 * re-encodes as JPEG. Returns the original file unchanged if it's already
 * under 1 MB AND under MAX_DIMENSION — no point recompressing.
 */
async function maybeCompress(
  file: File,
  onPhase: (next: Exclude<Phase, { kind: 'idle' }>) => void,
): Promise<Blob> {
  // HEIC needs decoding; the browser can't display it natively on most
  // platforms. Skip the canvas pass on HEIC — Supabase will accept it as-is
  // up to 10 MB.
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    return file;
  }

  // Tiny files: skip compression entirely. Avoids re-encoding a 200 KB image
  // and accidentally making it bigger (rare but possible).
  if (file.size < 1024 * 1024) return file;

  onPhase({ kind: 'reading', fileName: file.name, fileIndex: 0, totalFiles: 1 });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Not a valid image'));
    el.src = dataUrl;
  });

  onPhase({ kind: 'compressing', fileName: file.name, fileIndex: 0, totalFiles: 1 });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare canvas');
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  // If compression made it bigger (rare), use the original.
  return blob.size < file.size ? blob : file;
}

/**
 * PUT to a signed Supabase URL with real upload progress. Resolves on 2xx,
 * rejects with a descriptive Error otherwise.
 */
function uploadWithProgress(
  url: string,
  body: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', body.type || 'image/jpeg');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error('File too large for our storage limit. Crop and retry.'));
      else if (xhr.status === 401 || xhr.status === 403) reject(new Error('Upload link expired. Try again.'));
      else reject(new Error(`Upload failed (${xhr.status}). Check your connection and retry.`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try a smaller file or better connection.'));
    xhr.send(body);
  });
}
