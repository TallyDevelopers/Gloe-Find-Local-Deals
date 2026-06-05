'use client';

import { useState } from 'react';

/**
 * Manages a vendor's PROFILE video reel ("Inside the spa"). Unlike the deal
 * VideoUploader (which collects drafts and persists on deal-submit), this
 * persists immediately via injected callbacks, so it works the same whether a
 * vendor edits their own profile or an admin curates it at onboarding.
 *
 * The host wires `sign` / `onAdd` / `onDelete` to the right tRPC mutations
 * (vendor.* for self-service, admin.* with a vendorId for god-mode). The upload
 * mechanics (thumbnail grab + progress) live here, self-contained, so this can
 * never destabilize the deal form's uploader.
 */

export interface VendorVideoItem {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string | null;
  durationSeconds: number | null;
}

export interface VendorVideoDraft {
  videoUrl: string;
  thumbnailUrl: string;
  caption: string | null;
  durationSeconds: number | null;
}

interface Props {
  videos: VendorVideoItem[];
  /** Issue a signed upload URL for the given kind. */
  sign: (args: { fileExt: string; kind: 'photo' | 'video' }) => Promise<{ uploadUrl: string; publicUrl: string }>;
  /** Persist a freshly-uploaded video. Should refetch the list on the host. */
  onAdd: (draft: VendorVideoDraft) => Promise<void>;
  /** Remove a video by id. Should refetch the list on the host. */
  onDelete: (id: string) => Promise<void>;
  /** Disable interactions while a parent operation is in flight. */
  busy?: boolean;
  maxVideos?: number;
}

const MAX_BYTES = 100 * 1024 * 1024;

type Phase =
  | { kind: 'idle' }
  | { kind: 'thumb' }
  | { kind: 'video'; percent: number }
  | { kind: 'thumb-upload'; percent: number }
  | { kind: 'saving' };

export function VendorVideosManager({ videos, sign, onAdd, onDelete, busy = false, maxVideos = 12 }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploading = phase.kind !== 'idle';
  const disabled = uploading || busy;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('video/')) {
      setError(`"${file.name}" isn't a video. Use MP4, MOV, or WebM.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(`That clip is ${mb} MB. Max is 100 MB — trim it or export at lower quality.`);
      return;
    }

    try {
      setPhase({ kind: 'thumb' });
      const { thumbBlob, duration } = await grabThumbnail(file);

      const ext = file.name.split('.').pop() ?? 'mp4';
      const signedVideo = await sign({ fileExt: ext, kind: 'video' });
      await uploadWithProgress(signedVideo.uploadUrl, file, file.type || 'video/mp4', (pct) =>
        setPhase({ kind: 'video', percent: pct }),
      );

      const signedThumb = await sign({ fileExt: 'jpg', kind: 'photo' });
      await uploadWithProgress(signedThumb.uploadUrl, thumbBlob, 'image/jpeg', (pct) =>
        setPhase({ kind: 'thumb-upload', percent: pct }),
      );

      setPhase({ kind: 'saving' });
      await onAdd({
        videoUrl: signedVideo.publicUrl,
        thumbnailUrl: signedThumb.publicUrl,
        caption: null,
        durationSeconds: duration,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setPhase({ kind: 'idle' });
    }
  };

  const removeVideo = async (id: string) => {
    setError(null);
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that video.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {videos.map((v) => (
          <div key={v.id} style={{ position: 'relative', width: 120, height: 160 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.thumbnailUrl}
              alt={v.caption ?? 'video thumbnail'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
            />
            <span
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 28, textShadow: '0 1px 4px rgba(0,0,0,0.5)', pointerEvents: 'none',
              }}
            >
              ▶
            </span>
            <button
              type="button"
              aria-label="Remove video"
              onClick={() => removeVideo(v.id)}
              disabled={disabled || deletingId === v.id}
              style={{
                position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--text-primary)', color: '#fff', border: 'none', fontSize: 13, lineHeight: 1,
                cursor: disabled ? 'wait' : 'pointer',
              }}
            >
              {deletingId === v.id ? '…' : '×'}
            </button>
          </div>
        ))}

        {videos.length < maxVideos ? (
          <label
            style={{
              width: 120, height: 160, borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-default)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: disabled ? 'wait' : 'pointer', color: 'var(--text-tertiary)', fontSize: 13,
              textAlign: 'center', overflow: 'hidden', position: 'relative', padding: '0 8px',
            }}
          >
            {uploading ? <UploadProgress phase={phase} /> : '+ Add video'}
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
              disabled={disabled}
            />
          </label>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
          MP4, MOV, or WebM. Max 100 MB per clip. Vertical clips under 30s read best. {maxVideos} videos max.
        </span>
        {error ? <span style={{ color: 'var(--error)', fontSize: 13 }}>{error}</span> : null}
      </div>
    </div>
  );
}

/* ─────────────── helpers (self-contained; mirror the deal VideoUploader) ─────────────── */

function UploadProgress({ phase }: { phase: Phase }) {
  if (phase.kind === 'idle') return null;
  const label =
    phase.kind === 'thumb' ? 'Reading clip…'
    : phase.kind === 'video' ? `Video ${phase.percent}%`
    : phase.kind === 'thumb-upload' ? `Thumbnail ${phase.percent}%`
    : 'Saving…';
  const pct =
    phase.kind === 'thumb' ? 8
    : phase.kind === 'video' ? 10 + phase.percent * 0.8
    : phase.kind === 'thumb-upload' ? 90 + phase.percent * 0.05
    : 98;
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'var(--surface-secondary)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-500)', transition: 'width 120ms linear' }} />
      </div>
    </>
  );
}

function uploadWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error('File too large for our storage limit (100 MB max).'));
      else if (xhr.status === 401 || xhr.status === 403) reject(new Error('Upload link expired. Try again.'));
      else reject(new Error(`Upload failed (${xhr.status}). Check your connection and retry.`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try a smaller clip or better connection.'));
    xhr.send(body);
  });
}

/** Loads the video in a hidden element, seeks to ~1s, and snapshots a JPEG. */
function grabThumbnail(file: File): Promise<{ thumbBlob: Blob; duration: number | null }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        return reject(new Error('Could not prepare canvas'));
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) return reject(new Error('Could not generate thumbnail'));
          const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
          resolve({ thumbBlob: blob, duration });
        },
        'image/jpeg',
        0.8,
      );
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read video file. Try a different format (MP4 works best).'));
    };
  });
}
