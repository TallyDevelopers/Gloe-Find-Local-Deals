/**
 * Supabase Storage helper for signed upload URLs.
 *
 * The browser can't get a signed upload URL without the service key, and we
 * never want that key client-side. So the API creates the signed URL via the
 * Supabase Storage REST API and hands it back; the browser PUTs the file
 * straight to storage with it.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://xmjwrjvyiblinlnoszeh.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKETS = {
  photo: 'deal-photos',
  video: 'deal-videos',
  review: 'review-photos',
  support: 'support-attachments',
  // Private bucket — license docs are PII. `publicUrl` from createSignedUpload
  // will 403 for this kind; store the returned `path` and read via
  // createSignedReadUrl instead.
  license: 'license-docs',
} as const;

/** Buckets whose objects must never be publicly readable. */
const PRIVATE_BUCKETS: ReadonlySet<string> = new Set(['license-docs']);

export type UploadKind = keyof typeof BUCKETS;

export interface SignedUpload {
  /** PUT the file bytes here. */
  uploadUrl: string;
  /** Public URL the file will live at once uploaded. Store this on the deal. */
  publicUrl: string;
  /** Storage path/key. */
  path: string;
}

export async function createSignedUpload(
  vendorId: string,
  fileExt: string,
  kind: UploadKind = 'photo',
): Promise<SignedUpload> {
  if (!SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  const bucket = BUCKETS[kind];
  const safeExt = fileExt.replace(/[^a-z0-9]/gi, '').toLowerCase() || (kind === 'video' ? 'mp4' : 'jpg');
  const path = `${vendorId}/${crypto.randomUUID()}.${safeExt}`;

  // Ask Storage for a signed upload URL
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to sign upload: ${res.status}`);
  }
  const data = (await res.json()) as { url: string };

  return {
    uploadUrl: `${SUPABASE_URL}/storage/v1${data.url}`,
    // Private buckets have no public URL — callers store `path` and read via
    // createSignedReadUrl. Empty string instead of a URL that would 403.
    publicUrl: PRIVATE_BUCKETS.has(bucket)
      ? ''
      : `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`,
    path,
  };
}

/**
 * Short-lived signed READ URL for an object in a private bucket (e.g. a
 * license document an admin needs to view). Default expiry 10 minutes.
 */
export async function createSignedReadUrl(
  kind: UploadKind,
  path: string,
  expiresInSeconds = 600,
): Promise<string> {
  if (!SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  const bucket = BUCKETS[kind];
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
    // A storage stall must not hang whatever surface asked for the link.
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Failed to sign read URL: ${res.status}`);
  }
  const data = (await res.json()) as { signedURL: string };
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

/**
 * Uploads raw bytes the server already holds (e.g. a static map PNG fetched
 * from Google) straight to a public bucket, returning the public URL. Used to
 * cache one map image per deal so customers never hit Google per view.
 */
export async function uploadBytes(
  bucket: string,
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  if (!SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  const blob = new Blob([bytes], { type: contentType });
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload to ${bucket}: ${res.status}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
