'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

interface PhotoUploaderProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Uploads images to Supabase Storage via a signed URL issued by our API.
 * Flow: API signs an upload URL -> browser PUTs the file -> we store the
 * resulting public URL.
 */
export function PhotoUploader({ urls, onChange }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const utils = trpc.useUtils();
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
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - urls.length)) {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const signed = await signMutation.mutateAsync({ fileExt: ext });
        const put = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file,
        });
        if (!put.ok) throw new Error('Upload failed');
        newUrls.push(signed.publicUrl);
      }
      onChange([...urls, ...newUrls]);
    } catch {
      setError('Upload failed. Try a smaller image or different file.');
    } finally {
      setUploading(false);
      void utils; // reserved for future cache work
    }
  };

  const removeAt = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

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
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {uploading ? 'Uploading…' : '+ Add'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        ) : null}
      </div>
      {urls.length > 1 ? (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
          Drag to reorder. The first photo is the cover.
        </span>
      ) : null}
      {error ? <span style={{ color: 'var(--error)', fontSize: 13 }}>{error}</span> : null}
    </div>
  );
}
