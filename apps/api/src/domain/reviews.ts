import type { Sql } from '../db/client';

export interface ReviewSummary {
  id: string;
  authorFirstName: string | null;
  rating: number;
  body: string | null;
  createdAt: string;
  photoUrls: string[];
}

/**
 * The user's review of a single claim, if any. Returns null when the user
 * hasn't reviewed yet. Mobile uses this to pick "Leave a review" vs "Edit review".
 */
export async function getReviewForClaim(
  sql: Sql,
  claimId: string,
  userId: string,
): Promise<{ id: string; rating: number; body: string | null; photoUrls: string[] } | null> {
  const rows = await sql<{ id: string; rating: number; body: string | null }[]>`
    SELECT id, rating, body
    FROM public.reviews
    WHERE claim_id = ${claimId} AND user_id = ${userId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  const photos = await sql<{ url: string }[]>`
    SELECT url FROM public.review_photos WHERE review_id = ${r.id} ORDER BY display_order
  `;
  return { ...r, photoUrls: photos.map((p) => p.url) };
}

export async function listReviewsForVendor(
  sql: Sql,
  vendorId: string,
  limit = 20,
): Promise<ReviewSummary[]> {
  const rows = await sql<{
    id: string;
    rating: number;
    body: string | null;
    created_at: string;
    first_name: string | null;
  }[]>`
    SELECT r.id, r.rating, r.body, r.created_at, u.first_name
    FROM public.reviews r
    JOIN public.users u ON u.id = r.user_id
    WHERE r.vendor_id = ${vendorId} AND r.is_hidden = false
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];

  // One photo query for all reviews in the page → cheaper than N round-trips.
  const ids = rows.map((r) => r.id);
  const photos = await sql<{ review_id: string; url: string }[]>`
    SELECT review_id, url FROM public.review_photos
    WHERE review_id = ANY(${sql.array(ids)})
    ORDER BY display_order
  `;
  const photosByReview = new Map<string, string[]>();
  for (const p of photos) {
    if (!photosByReview.has(p.review_id)) photosByReview.set(p.review_id, []);
    photosByReview.get(p.review_id)!.push(p.url);
  }

  return rows.map((r) => ({
    id: r.id,
    authorFirstName: r.first_name,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
    photoUrls: photosByReview.get(r.id) ?? [],
  }));
}

interface CreateReviewInput {
  userId: string;
  claimId: string;
  rating: number;
  body?: string;
  /** Already-uploaded URLs from review-photos bucket. Caps at 3 (router enforces). */
  photoUrls?: string[];
}

/**
 * Creates or updates a review for a claim. Idempotent on (claim_id) — re-submitting
 * the same claim updates the existing review instead of throwing. Also rolls the
 * vendor's `rating_avg` and `review_count` aggregates so the storefront updates.
 */
export async function createReview(sql: Sql, input: CreateReviewInput): Promise<{ id: string }> {
  const { userId, claimId, rating, body } = input;

  // Eligibility: claim must belong to user AND be redeemed (you can only
  // review a service you actually used).
  const claim = await sql<{
    vendor_id: string;
    deal_id: string;
    status: string;
  }[]>`
    SELECT vendor_id, deal_id, status FROM public.claims
    WHERE id = ${claimId} AND user_id = ${userId}
    LIMIT 1
  `;
  const c = claim[0];
  if (!c) throw new Error('Claim not found');
  if (c.status !== 'redeemed') throw new Error('Only redeemed claims can be reviewed');

  // claim_id has a unique index — upsert by it so re-submitting just updates.
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO public.reviews (claim_id, user_id, vendor_id, deal_id, rating, body)
    VALUES (${claimId}, ${userId}, ${c.vendor_id}, ${c.deal_id}, ${rating}, ${body ?? null})
    ON CONFLICT (claim_id) DO UPDATE
    SET rating     = EXCLUDED.rating,
        body       = EXCLUDED.body,
        updated_at = now()
    RETURNING id
  `;
  const row = inserted[0];
  if (!row) throw new Error('Failed to insert review');

  // Photos: replace-all semantics on every save. Keeps the API simple — the
  // client always sends the desired final state, server makes it so. Re-edits
  // can drop photos as easily as adding them.
  await sql`DELETE FROM public.review_photos WHERE review_id = ${row.id}`;
  const urls = input.photoUrls ?? [];
  for (let i = 0; i < urls.length; i++) {
    await sql`
      INSERT INTO public.review_photos (review_id, url, display_order)
      VALUES (${row.id}, ${urls[i]!}, ${i})
    `;
  }

  // Roll the vendor aggregates. Cheap because rating_avg / review_count are
  // computed only from non-hidden reviews on this vendor.
  await sql`
    UPDATE public.vendors v
    SET rating_avg   = sub.avg_rating,
        review_count = sub.review_count
    FROM (
      SELECT AVG(rating)::numeric(2,1) AS avg_rating, COUNT(*)::int AS review_count
      FROM public.reviews
      WHERE vendor_id = ${c.vendor_id} AND is_hidden = false
    ) AS sub
    WHERE v.id = ${c.vendor_id}
  `;

  return { id: row.id };
}
