import { TRPCError } from '@trpc/server';

import type { Sql } from '../db/client';

/**
 * Service taxonomy admin (god mode) — categories + the treatments under them.
 *
 * The taxonomy lives in `service_categories` / `service_subtypes` and is the
 * spine of the whole marketplace: vendor signup chips, the deal form's
 * treatment picker, Discover filter pills, and search (subtype display names
 * are matched directly in SQL, so a treatment added here is instantly
 * searchable). Historically it was only editable via SQL migrations; these
 * functions power the admin console's Treatments tab instead.
 *
 * "Remove" is soft (active = false) because deals reference subtype_id —
 * hiding a treatment keeps old deals intact while dropping it from every
 * picker, pill, and suggestion. Hard delete is allowed only when no deal has
 * ever referenced the subtype.
 */

export interface AdminSubtype {
  id: string;
  slug: string;
  displayName: string;
  unitLabel: string | null;
  helperText: string | null;
  displayOrder: number;
  active: boolean;
  /** Lifetime count of deals tagged with this treatment (any status). */
  dealCount: number;
}

export interface AdminCategory {
  id: string;
  slug: string;
  displayName: string;
  isUnitBased: boolean;
  displayOrder: number;
  active: boolean;
  subtypes: AdminSubtype[];
}

/** Everything, including inactive rows — the admin view shows hidden items. */
export async function listTaxonomy(sql: Sql): Promise<AdminCategory[]> {
  const cats = await sql<{
    id: string; slug: string; display_name: string; is_unit_based: boolean;
    display_order: number; active: boolean;
  }[]>`
    SELECT id, slug, display_name, is_unit_based, display_order, active
    FROM public.service_categories
    ORDER BY display_order, display_name
  `;
  const subs = await sql<{
    id: string; category_id: string; slug: string; display_name: string;
    unit_label: string | null; helper_text: string | null;
    display_order: number; active: boolean; deal_count: number;
  }[]>`
    SELECT s.id, s.category_id, s.slug, s.display_name, s.unit_label, s.helper_text,
           s.display_order, s.active,
           (SELECT COUNT(*)::int FROM public.deals d WHERE d.subtype_id = s.id) AS deal_count
    FROM public.service_subtypes s
    ORDER BY s.display_order, s.display_name
  `;
  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    displayName: c.display_name,
    isUnitBased: c.is_unit_based,
    displayOrder: c.display_order,
    active: c.active,
    subtypes: subs
      .filter((s) => s.category_id === c.id)
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        displayName: s.display_name,
        unitLabel: s.unit_label,
        helperText: s.helper_text,
        displayOrder: s.display_order,
        active: s.active,
        dealCount: s.deal_count,
      })),
  }));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (Avéli → aveli)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'treatment';
}

export interface CreateSubtypeInput {
  categoryId: string;
  displayName: string;
  unitLabel?: string | null;
  helperText?: string | null;
}

export async function createSubtype(sql: Sql, input: CreateSubtypeInput): Promise<{ id: string; slug: string }> {
  const base = slugify(input.displayName);
  // New treatments go to the end of their category.
  const [row] = await sql<{ id: string; slug: string }[]>`
    INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, helper_text, display_order, active)
    SELECT ${input.categoryId},
           CASE WHEN EXISTS (
             SELECT 1 FROM public.service_subtypes
             WHERE category_id = ${input.categoryId} AND slug = ${base}
           )
           THEN ${base} || '-' || floor(random() * 9000 + 1000)::text
           ELSE ${base} END,
           ${input.displayName.trim()},
           ${input.unitLabel?.trim() || null},
           ${input.helperText?.trim() || null},
           COALESCE((SELECT MAX(display_order) + 1 FROM public.service_subtypes WHERE category_id = ${input.categoryId}), 1),
           true
    RETURNING id, slug
  `;
  if (!row) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not create treatment.' });
  return row;
}

export interface UpdateSubtypeInput {
  id: string;
  displayName?: string;
  unitLabel?: string | null;
  helperText?: string | null;
  active?: boolean;
  displayOrder?: number;
}

export async function updateSubtype(sql: Sql, input: UpdateSubtypeInput): Promise<void> {
  const res = await sql`
    UPDATE public.service_subtypes SET
      display_name  = COALESCE(${input.displayName?.trim() ?? null}, display_name),
      unit_label    = ${input.unitLabel === undefined ? sql`unit_label` : (input.unitLabel?.trim() || null)},
      helper_text   = ${input.helperText === undefined ? sql`helper_text` : (input.helperText?.trim() || null)},
      active        = COALESCE(${input.active ?? null}, active),
      display_order = COALESCE(${input.displayOrder ?? null}, display_order)
    WHERE id = ${input.id}
  `;
  if (res.count === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Treatment not found.' });
}

/** Hard delete — only allowed when no deal has ever been tagged with it. */
export async function deleteSubtype(sql: Sql, id: string): Promise<void> {
  const [ref] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM public.deals WHERE subtype_id = ${id}
  `;
  if ((ref?.n ?? 0) > 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `${ref!.n} deal(s) reference this treatment — hide it instead of deleting.`,
    });
  }
  await sql`DELETE FROM public.service_subtypes WHERE id = ${id}`;
}

/** Swap-style reorder within one category: ids in their new order. */
export async function reorderSubtypes(sql: Sql, categoryId: string, orderedIds: string[]): Promise<void> {
  await sql.begin(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx`
        UPDATE public.service_subtypes SET display_order = ${i + 1}
        WHERE id = ${orderedIds[i]!} AND category_id = ${categoryId}
      `;
    }
  });
}

export interface UpdateCategoryInput {
  id: string;
  displayName?: string;
  active?: boolean;
  displayOrder?: number;
}

/** Categories themselves: rename / hide / reorder (no create — the 8 are the product). */
export async function updateCategory(sql: Sql, input: UpdateCategoryInput): Promise<void> {
  const res = await sql`
    UPDATE public.service_categories SET
      display_name  = COALESCE(${input.displayName?.trim() ?? null}, display_name),
      active        = COALESCE(${input.active ?? null}, active),
      display_order = COALESCE(${input.displayOrder ?? null}, display_order)
    WHERE id = ${input.id}
  `;
  if (res.count === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Category not found.' });
}
