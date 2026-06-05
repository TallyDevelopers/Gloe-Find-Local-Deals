/**
 * Vendor-level media (currently: profile videos). These power the storefront's
 * "Inside the spa" reel and are owned by the vendor, independent of any deal.
 * Uploaded by the vendor (self-service dashboard) or by an admin at onboarding.
 */

import type { Sql } from '../db/client';

export interface VendorVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string | null;
  durationSeconds: number | null;
  displayOrder: number;
}

export interface VendorVideoInput {
  videoUrl: string;
  thumbnailUrl: string;
  caption?: string | null;
  durationSeconds?: number | null;
}

const MAX_VENDOR_VIDEOS = 12;

interface Row {
  id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string | null;
  duration_seconds: number | null;
  display_order: number;
}

const mapRow = (r: Row): VendorVideo => ({
  id: r.id,
  videoUrl: r.video_url,
  thumbnailUrl: r.thumbnail_url,
  caption: r.caption,
  durationSeconds: r.duration_seconds,
  displayOrder: r.display_order,
});

export async function listVendorVideos(sql: Sql, vendorId: string): Promise<VendorVideo[]> {
  const rows = await sql<Row[]>`
    SELECT id, video_url, thumbnail_url, caption, duration_seconds, display_order
    FROM public.vendor_videos
    WHERE vendor_id = ${vendorId}
    ORDER BY display_order, created_at DESC
  `;
  return rows.map(mapRow);
}

/** Appends a video to the end of the vendor's reel. Caps at MAX_VENDOR_VIDEOS. */
export async function addVendorVideo(
  sql: Sql,
  vendorId: string,
  input: VendorVideoInput,
): Promise<VendorVideo> {
  const countRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM public.vendor_videos WHERE vendor_id = ${vendorId}
  `;
  if (Number(countRows[0]?.count ?? 0) >= MAX_VENDOR_VIDEOS) {
    throw new Error(`You can have up to ${MAX_VENDOR_VIDEOS} profile videos.`);
  }
  const orderRows = await sql<{ next: number }[]>`
    SELECT COALESCE(MAX(display_order) + 1, 0) AS next FROM public.vendor_videos WHERE vendor_id = ${vendorId}
  `;
  const nextOrder = orderRows[0]?.next ?? 0;
  const rows = await sql<Row[]>`
    INSERT INTO public.vendor_videos (vendor_id, video_url, thumbnail_url, caption, duration_seconds, display_order)
    VALUES (${vendorId}, ${input.videoUrl}, ${input.thumbnailUrl}, ${input.caption ?? null}, ${input.durationSeconds ?? null}, ${nextOrder})
    RETURNING id, video_url, thumbnail_url, caption, duration_seconds, display_order
  `;
  return mapRow(rows[0]!);
}

/** Deletes a video, scoped to the owning vendor so one vendor can't touch another's. */
export async function deleteVendorVideo(sql: Sql, vendorId: string, videoId: string): Promise<void> {
  await sql`
    DELETE FROM public.vendor_videos WHERE id = ${videoId} AND vendor_id = ${vendorId}
  `;
}
