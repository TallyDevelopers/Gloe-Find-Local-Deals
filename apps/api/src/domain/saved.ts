import type { Sql } from '../db/client';

export async function listSavedDealIds(sql: Sql, userId: string): Promise<string[]> {
  const rows = await sql<{ deal_id: string }[]>`
    SELECT deal_id FROM public.saved_deals WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return rows.map((r) => r.deal_id);
}

/**
 * Toggle a save. Returns the new saved state.
 */
export async function toggleSaved(
  sql: Sql,
  userId: string,
  dealId: string,
): Promise<{ saved: boolean }> {
  const existing = await sql<{ deal_id: string }[]>`
    SELECT deal_id FROM public.saved_deals
    WHERE user_id = ${userId} AND deal_id = ${dealId}
  `;
  if (existing.length > 0) {
    await sql`DELETE FROM public.saved_deals WHERE user_id = ${userId} AND deal_id = ${dealId}`;
    return { saved: false };
  }
  await sql`
    INSERT INTO public.saved_deals (user_id, deal_id)
    VALUES (${userId}, ${dealId})
  `;
  return { saved: true };
}
