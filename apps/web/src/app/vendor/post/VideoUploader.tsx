'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

export interface DealVideoDraft {
  videoUrl: string;
  thumbnailUrl: string;
  caption: string | null;
  durationSeconds: number | null;
}

interface VideoUploaderProps {
  videos: DealVideoDraft[];
  onChange: (videos: DealVideoDraft[]) => void;
}

const MAX_VIDEOS = 6;

/**
 * Uploads a short clip + an auto-grabbed first-frame thumbnail to Supabase
 * Storage via signed URLs. These render in the app's "Inside [vendor]" reel.
 */
export function VideoUploader({ videos, onChange }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sign = trpc.vendor.signPhotoUpload.useMutation();

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { thumbBlob, duration } = await grabThumbnail(file);

      const ext = file.name.split('.').pop() ?? 'mp4';
      const signedVideo = await sign.mutateAsync({ fileExt: ext, kind: 'video' });
      await putFile(signedVideo.uploadUrl, file, file.type || 'video/mp4');

      const signedThumb = await sign.mutateAsync({ fileExt: 'jpg', kind: 'photo' });
      await putFile(signedThumb.uploadUrl, thumbBlob, 'image/jpeg');

      onChange([
        ...videos,
        {
          videoUrl: signedVideo.publicUrl,
          thumbnailUrl: signedThumb.publicUrl,
          caption: null,
          durationSeconds: duration,
        },
      ]);
    } catch {
      setError('Upload failed. Try a shorter clip or a different file.');
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (i: number) => onChange(videos.filter((_, idx) => idx !== i));
  const setCaption = (i: number, caption: string) =>
    onChange(videos.map((v, idx) => (idx === i ? { ...v, caption: caption || null } : v)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {videos.map((v, i) => (
          <div key={v.videoUrl} style={{ width: 120 }}>
            <div style={{ position: 'relative', width: 120, height: 160 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumbnailUrl}
                alt="video thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 28,
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}
              >
                ▶
              </span>
              <button
                onClick={() => removeAt(i)}
                style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'var(--text-primary)', color: '#fff', border: 'none', fontSize: 13, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <input
              value={v.caption ?? ''}
              onChange={(e) => setCaption(i, e.target.value)}
              placeholder="Caption…"
              maxLength={140}
              style={{
                marginTop: 6,
                width: '100%',
                fontSize: 12,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        ))}

        {videos.length < MAX_VIDEOS ? (
          <label
            style={{
              width: 120,
              height: 160,
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
            {uploading ? 'Uploading…' : '+ Add video'}
            <input
              type="file"
              accept="video/*"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        ) : null}
      </div>
      {error ? <span style={{ color: 'var(--error)', fontSize: 13 }}>{error}</span> : null}
    </div>
  );
}

async function putFile(url: string, body: Blob, contentType: string) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!res.ok) throw new Error('Upload failed');
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
        return reject(new Error('no canvas'));
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) return reject(new Error('no thumbnail'));
          const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
          resolve({ thumbBlob: blob, duration });
        },
        'image/jpeg',
        0.8,
      );
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('cannot read video'));
    };
  });
}
