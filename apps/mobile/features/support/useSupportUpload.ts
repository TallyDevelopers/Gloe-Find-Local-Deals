import { trpc } from '@gloe/api-client';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

/**
 * Hook for picking + uploading support-ticket attachments (photos & videos).
 *
 * Mirrors the upload flow in features/reviews/ReviewSheet.tsx:
 *   pick → sign a Supabase upload URL → fetch local bytes as a Blob →
 *   PUT with progress → keep the public URL.
 *
 * Each attachment tracks its own lifecycle so the chat composer can show
 * per-item progress / errors. Videos get a generated poster frame when
 * expo-video-thumbnails is installed; otherwise the renderer overlays a play
 * button on the raw video URL.
 *
 * Usage:
 *   const upload = useSupportUpload();
 *   await upload.pickAndUpload();
 *   // upload.attachments → render thumbnails + progress
 *   // on send: upload.attachments.filter(a => a.status === 'done').map(a => ({ kind, url, thumbnailUrl, width, height }))
 */

export type SupportAttachmentStatus = 'uploading' | 'done' | 'error';

export interface SupportAttachment {
  /** Stable key for list rendering + targeting removals/retries. */
  localUri: string;
  kind: 'image' | 'video';
  /** Public Supabase URL — only populated once status === 'done'. */
  url: string;
  /** Poster frame for videos (best-effort). Undefined ⇒ show a play overlay. */
  thumbnailUrl?: string;
  width: number;
  height: number;
  status: SupportAttachmentStatus;
  /** 0–100 while uploading. */
  progress: number;
  /** Populated when status === 'error'. */
  errorMsg?: string;
  /** Carried across retries; not part of the wire shape. */
  mimeType: string;
}

export interface UseSupportUpload {
  attachments: SupportAttachment[];
  /** True while any attachment is mid-upload (disable Send). */
  isUploading: boolean;
  /** Opens the photo library, requests permission, uploads each picked asset. */
  pickAndUpload: () => Promise<void>;
  /** Opens the camera to take a new photo/video, then uploads it. */
  takePhoto: () => Promise<void>;
  removeAttachment: (localUri: string) => void;
  retryAttachment: (localUri: string) => void;
  clear: () => void;
  /** Last permission/picker-level error (not per-item upload errors). */
  error: string | null;
}

export function useSupportUpload(): UseSupportUpload {
  const sign = trpc.support.signAttachmentUpload.useMutation();
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((localUri: string, next: Partial<SupportAttachment>) => {
    setAttachments((prev) =>
      prev.map((a) => (a.localUri === localUri ? { ...a, ...next } : a)),
    );
  }, []);

  const uploadOne = useCallback(
    async (item: SupportAttachment) => {
      try {
        const ext = deriveExt(item.localUri, item.kind, item.mimeType);
        const signed = await sign.mutateAsync({ fileExt: ext, kind: item.kind });

        // Expo URIs are already file:// / content:// — fetch reads the bytes.
        const res = await fetch(item.localUri);
        const blob = await res.blob();
        await uploadWithProgress(signed.uploadUrl, blob, item.mimeType, (pct) => {
          patch(item.localUri, { progress: pct });
        });

        // For videos, best-effort generate a poster frame *after* the video
        // itself is safely uploaded. Failure here is non-fatal.
        let thumbnailUrl: string | undefined;
        if (item.kind === 'video') {
          thumbnailUrl = await uploadVideoThumbnail(item.localUri, sign.mutateAsync);
        }

        patch(item.localUri, {
          status: 'done',
          progress: 100,
          url: signed.publicUrl,
          thumbnailUrl,
          errorMsg: undefined,
        });
      } catch (e) {
        patch(item.localUri, {
          status: 'error',
          errorMsg: e instanceof Error ? e.message : 'Upload failed.',
        });
      }
    },
    [sign, patch],
  );

  // Shared: turn picked/captured assets into pending tiles + upload them.
  const ingest = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (assets.length === 0) return;
      const newItems: SupportAttachment[] = assets.map((a) => {
        const kind: 'image' | 'video' = a.type === 'video' ? 'video' : 'image';
        return {
          localUri: a.uri,
          kind,
          url: '',
          thumbnailUrl: undefined,
          width: a.width ?? 0,
          height: a.height ?? 0,
          status: 'uploading',
          progress: 0,
          mimeType: a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        };
      });
      setAttachments((prev) => [...prev, ...newItems]);
      await Promise.all(newItems.map((item) => uploadOne(item)));
    },
    [uploadOne],
  );

  // Pick from the photo library (camera roll).
  const pickAndUpload = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photos access is off. Enable it in Settings → Gloe → Photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    await ingest(result.assets);
  }, [ingest]);

  // Take a new photo or video with the camera.
  const takePhoto = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera access is off. Enable it in Settings → Gloe → Camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    await ingest(result.assets);
  }, [ingest]);

  const removeAttachment = useCallback((localUri: string) => {
    setAttachments((prev) => prev.filter((a) => a.localUri !== localUri));
  }, []);

  const retryAttachment = useCallback(
    (localUri: string) => {
      setAttachments((prev) => {
        const target = prev.find((a) => a.localUri === localUri);
        if (target) {
          void uploadOne({ ...target, status: 'uploading', progress: 0, errorMsg: undefined });
        }
        return prev.map((a) =>
          a.localUri === localUri
            ? { ...a, status: 'uploading', progress: 0, errorMsg: undefined }
            : a,
        );
      });
    },
    [uploadOne],
  );

  const clear = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const isUploading = attachments.some((a) => a.status === 'uploading');

  return {
    attachments,
    isUploading,
    pickAndUpload,
    takePhoto,
    removeAttachment,
    retryAttachment,
    clear,
    error,
  };
}

/* ─────────────── helpers ─────────────── */

/** Derive a short file extension for the signed-upload request. */
function deriveExt(localUri: string, kind: 'image' | 'video', mimeType: string): string {
  const fromUri = (localUri.split('?')[0] ?? localUri).split('.').pop();
  if (fromUri && fromUri.length <= 5 && /^[a-z0-9]+$/i.test(fromUri)) return fromUri.toLowerCase();
  const fromMime = mimeType.split('/').pop();
  if (fromMime && fromMime.length <= 5 && /^[a-z0-9]+$/i.test(fromMime)) return fromMime.toLowerCase();
  return kind === 'video' ? 'mp4' : 'jpg';
}

type SignFn = (input: {
  fileExt: string;
  kind: 'image' | 'video';
}) => Promise<{ uploadUrl: string; publicUrl: string }>;

/**
 * Best-effort poster frame for a video. Uses expo-video-thumbnails if it's
 * installed; uploads the generated JPEG and returns its public URL. Any failure
 * (module missing, generation error, upload error) resolves to undefined so the
 * caller falls back to a play overlay on the raw video.
 */
async function uploadVideoThumbnail(
  videoUri: string,
  sign: SignFn,
): Promise<string | undefined> {
  try {
    // Optional dependency — not installed today. Guarded require so the bundle
    // builds without it; typed loosely since there are no type declarations.
    let VideoThumbnails: { getThumbnailAsync?: (uri: string, opts?: unknown) => Promise<{ uri: string }> } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      VideoThumbnails = require('expo-video-thumbnails');
    } catch {
      return undefined;
    }
    if (!VideoThumbnails?.getThumbnailAsync) return undefined;

    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 0,
      quality: 0.7,
    });
    const signed = await sign({ fileExt: 'jpg', kind: 'image' });
    const res = await fetch(uri);
    const blob = await res.blob();
    await uploadWithProgress(signed.uploadUrl, blob, 'image/jpeg', () => {});
    return signed.publicUrl;
  } catch {
    return undefined;
  }
}

/**
 * PUT to a signed Supabase URL with progress. Copied from
 * features/reviews/ReviewSheet.tsx to avoid a cross-module dep.
 */
function uploadWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new Error('File too large.'));
      else if (xhr.status === 401 || xhr.status === 403) reject(new Error('Upload link expired.'));
      else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(body);
  });
}
