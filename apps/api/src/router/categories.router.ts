import { publicProcedure, router } from './trpc';

export const categoriesRouter = router({
  /** All active categories with their subtypes — powers the deal form + filters. */
  list: publicProcedure.query(async ({ ctx }) => {
    const cats = await ctx.sql<{ id: string; slug: string; display_name: string; is_unit_based: boolean }[]>`
      SELECT id, slug, display_name, is_unit_based
      FROM public.service_categories
      WHERE active = true
      ORDER BY display_order
    `;
    const subs = await ctx.sql<{
      id: string;
      category_id: string;
      slug: string;
      display_name: string;
      unit_label: string | null;
      helper_text: string | null;
    }[]>`
      SELECT id, category_id, slug, display_name, unit_label, helper_text
      FROM public.service_subtypes
      WHERE active = true
      ORDER BY display_order, display_name
    `;
    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      displayName: c.display_name,
      isUnitBased: c.is_unit_based,
      subtypes: subs
        .filter((s) => s.category_id === c.id)
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          displayName: s.display_name,
          unitLabel: s.unit_label,
          helperText: s.helper_text,
        })),
    }));
  }),
});
