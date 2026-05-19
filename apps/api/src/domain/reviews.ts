import type { Sql } from '../db/client';

export interface ReviewSummary {
  id: string;
  authorFirstName: string | null;
  rating: number;
  body: string | null;
  createdAt: string;
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
  return rows.map((r) => ({
    id: r.id,
    authorFirstName: r.first_name,
    rating: r.rating,
    body: r.body,
    createdAt: r.created_at,
  }));
}

interface CreateReviewInput {
  userId: string;
  claimId: string;
  rating: number;
  body?: string;
}

export async function createReview(sql: Sql, input: CreateReviewInput): Promise<{ id: string }> {
  const { userId, claimId, rating, body } = input;

  // Look up the claim — must belong to user and be redeemed
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

  const inserted = await sql<{ id: string }[]>`
    INSERT INTO public.reviews (claim_id, user_id, vendor_id, deal_id, rating, body)
    VALUES (${claimId}, ${userId}, ${c.vendor_id}, ${c.deal_id}, ${rating}, ${body ?? null})
    RETURNING id
  `;
  const row = inserted[0];
  if (!row) throw new Error('Failed to insert review');
  return { id: row.id };
}
