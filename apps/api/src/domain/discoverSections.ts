import type { Sql, TxSql } from '../db/client';

/**
 * Discover editorial sections (GLO-27) — the admin-edited merchandising layer
 * on the home (All) feed. Each section is a warm tagline that REPLACES the dry
 * category noun on a rail, an optional typed DESCRIPTION under it, and a target
 * set that pools deals from 1..N whole categories AND/OR specific treatments
 * (subtypes) — so the founder can merchandise a single trend ("Rhinoplasty
 * without living with it forever" → Liquid Rhinoplasty) without inventing a
 * category for it. Source of truth = DB; authored/reordered/toggled in the
 * admin console. When no active section exists the feed falls back to
 * one-rail-per-category (see getDiscoverFeed), so it ships before any section
 * is authored and never blanks the feed.
 *
 * Reads here power the admin console; the consumer feed reads sections inline in
 * getDiscoverFeed (deals.ts) to share one DB round-trip with the rails.
 */

export interface DiscoverSection {
  id: string;
  tagline: string;
  /** Optional admin-typed copy shown under the tagline. */
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  active: boolean;
  /** Category ids assigned to this section, in their stored order. */
  categoryIds: string[];
  /** Treatment (subtype) ids assigned to this section, in their stored order. */
  subtypeIds: string[];
  updatedAt: string;
}

interface SectionRow {
  id: string;
  tagline: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  active: boolean;
  category_ids: string[];
  subtype_ids: string[];
  updated_at: string;
}

function mapSection(r: SectionRow): DiscoverSection {
  return {
    id: r.id,
    tagline: r.tagline,
    description: r.description,
    imageUrl: r.image_url,
    displayOrder: r.display_order,
    active: r.active,
    categoryIds: r.category_ids ?? [],
    subtypeIds: r.subtype_ids ?? [],
    updatedAt: r.updated_at,
  };
}

/** Public, consumer-facing read: active sections with their category + treatment
 *  SLUGS, tagline, description and image, in display order. Powers the web
 *  home's editorial rails (the web pools deals client-side from its existing
 *  feed). Sections whose every target is inactive are omitted (they'd pool
 *  nothing). */
export interface PublicDiscoverSection {
  id: string;
  tagline: string;
  description: string | null;
  imageUrl: string | null;
  categorySlugs: string[];
  subtypeSlugs: string[];
}

export async function listActiveDiscoverSections(sql: Sql): Promise<PublicDiscoverSection[]> {
  const rows = await sql<{
    id: string; tagline: string; description: string | null; image_url: string | null;
    category_slugs: string[]; subtype_slugs: string[];
  }[]>`
    SELECT
      s.id, s.tagline, s.description, s.image_url,
      (
        SELECT COALESCE(array_agg(c.slug ORDER BY sc.position, c.display_order), '{}')
        FROM public.discover_section_categories sc
        JOIN public.service_categories c ON c.id = sc.category_id AND c.active = true
        WHERE sc.section_id = s.id
      ) AS category_slugs,
      (
        SELECT COALESCE(array_agg(st.slug ORDER BY ss.position, st.display_order), '{}')
        FROM public.discover_section_subtypes ss
        JOIN public.service_subtypes st ON st.id = ss.subtype_id AND st.active = true
        WHERE ss.section_id = s.id
      ) AS subtype_slugs
    FROM public.discover_sections s
    WHERE s.active = true
    ORDER BY s.display_order
  `;
  return rows
    .filter((r) => r.category_slugs.length > 0 || r.subtype_slugs.length > 0)
    .map((r) => ({
      id: r.id,
      tagline: r.tagline,
      description: r.description,
      imageUrl: r.image_url,
      categorySlugs: r.category_slugs,
      subtypeSlugs: r.subtype_slugs,
    }));
}

/** Every section (active + inactive), for the admin console, in display order. */
export async function listDiscoverSections(sql: Sql): Promise<DiscoverSection[]> {
  const rows = await sql<SectionRow[]>`
    SELECT
      s.id, s.tagline, s.description, s.image_url, s.display_order, s.active, s.updated_at,
      (
        SELECT COALESCE(array_agg(sc.category_id ORDER BY sc.position), '{}')
        FROM public.discover_section_categories sc WHERE sc.section_id = s.id
      ) AS category_ids,
      (
        SELECT COALESCE(array_agg(ss.subtype_id ORDER BY ss.position), '{}')
        FROM public.discover_section_subtypes ss WHERE ss.section_id = s.id
      ) AS subtype_ids
    FROM public.discover_sections s
    ORDER BY s.display_order, s.created_at
  `;
  return rows.map(mapSection);
}

async function getSection(sql: Sql | TxSql, id: string): Promise<DiscoverSection | null> {
  const rows = await sql<SectionRow[]>`
    SELECT
      s.id, s.tagline, s.description, s.image_url, s.display_order, s.active, s.updated_at,
      (
        SELECT COALESCE(array_agg(sc.category_id ORDER BY sc.position), '{}')
        FROM public.discover_section_categories sc WHERE sc.section_id = s.id
      ) AS category_ids,
      (
        SELECT COALESCE(array_agg(ss.subtype_id ORDER BY ss.position), '{}')
        FROM public.discover_section_subtypes ss WHERE ss.section_id = s.id
      ) AS subtype_ids
    FROM public.discover_sections s
    WHERE s.id = ${id}
  `;
  return rows[0] ? mapSection(rows[0]) : null;
}

/** Replace a section's category set inside a transaction. Validates the ids
 *  exist so a bad id surfaces as an error rather than a silently-empty rail. */
async function setCategories(sql: TxSql, sectionId: string, categoryIds: string[]): Promise<void> {
  const unique = [...new Set(categoryIds)];
  await sql`DELETE FROM public.discover_section_categories WHERE section_id = ${sectionId}`;
  // Insert with a position index so the admin's order is preserved. One INSERT
  // per row matches the codebase's photo/video pattern (replaceDealPhotos).
  for (let i = 0; i < unique.length; i++) {
    await sql`
      INSERT INTO public.discover_section_categories (section_id, category_id, position)
      VALUES (${sectionId}, ${unique[i]!}, ${i})
    `;
  }
}

/** Replace a section's treatment set inside a transaction (same shape as categories). */
async function setSubtypes(sql: TxSql, sectionId: string, subtypeIds: string[]): Promise<void> {
  const unique = [...new Set(subtypeIds)];
  await sql`DELETE FROM public.discover_section_subtypes WHERE section_id = ${sectionId}`;
  for (let i = 0; i < unique.length; i++) {
    await sql`
      INSERT INTO public.discover_section_subtypes (section_id, subtype_id, position)
      VALUES (${sectionId}, ${unique[i]!}, ${i})
    `;
  }
}

export interface CreateDiscoverSectionInput {
  tagline: string;
  description?: string | null;
  categoryIds?: string[];
  subtypeIds?: string[];
  imageUrl?: string | null;
  /** Defaults to the end of the list when omitted. */
  displayOrder?: number;
  active?: boolean;
}

export async function createDiscoverSection(
  sql: Sql,
  input: CreateDiscoverSectionInput,
): Promise<DiscoverSection> {
  return sql.begin(async (tx) => {
    // Default new sections to the end of the order so they don't jump the line.
    const order =
      input.displayOrder ??
      (await tx<{ next: number }[]>`
        SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM public.discover_sections
      `)[0]!.next;
    const rows = await tx<{ id: string }[]>`
      INSERT INTO public.discover_sections (tagline, description, image_url, display_order, active)
      VALUES (${input.tagline}, ${input.description ?? null}, ${input.imageUrl ?? null}, ${order}, ${input.active ?? true})
      RETURNING id
    `;
    const id = rows[0]!.id;
    await setCategories(tx, id, input.categoryIds ?? []);
    await setSubtypes(tx, id, input.subtypeIds ?? []);
    const created = await getSection(tx, id);
    if (!created) throw new Error('Failed to create section');
    return created;
  });
}

export interface UpdateDiscoverSectionInput {
  id: string;
  tagline?: string;
  /** `null` clears the description; absent leaves it untouched. */
  description?: string | null;
  /** When provided, REPLACES the section's category set. Omit to leave as-is. */
  categoryIds?: string[];
  /** When provided, REPLACES the section's treatment set. Omit to leave as-is. */
  subtypeIds?: string[];
  imageUrl?: string | null;
  displayOrder?: number;
  active?: boolean;
}

/** Partial update. Only the provided fields change (COALESCE keeps the rest);
 *  categoryIds/subtypeIds, when present, replace the whole set. */
export async function updateDiscoverSection(
  sql: Sql,
  input: UpdateDiscoverSectionInput,
): Promise<DiscoverSection | null> {
  return sql.begin(async (tx) => {
    await tx`
      UPDATE public.discover_sections SET
        tagline       = COALESCE(${input.tagline ?? null}, tagline),
        display_order = COALESCE(${input.displayOrder ?? null}, display_order),
        active        = COALESCE(${input.active ?? null}, active)
      WHERE id = ${input.id}
    `;
    // image_url/description are nullable on purpose: `null` clears, `undefined`
    // (the key absent) leaves it untouched — so they can't fold into COALESCE.
    if (input.imageUrl !== undefined) {
      await tx`UPDATE public.discover_sections SET image_url = ${input.imageUrl} WHERE id = ${input.id}`;
    }
    if (input.description !== undefined) {
      await tx`UPDATE public.discover_sections SET description = ${input.description} WHERE id = ${input.id}`;
    }
    if (input.categoryIds !== undefined) {
      await setCategories(tx, input.id, input.categoryIds);
    }
    if (input.subtypeIds !== undefined) {
      await setSubtypes(tx, input.id, input.subtypeIds);
    }
    return getSection(tx, input.id);
  });
}

export async function deleteDiscoverSection(sql: Sql, id: string): Promise<void> {
  // The join rows cascade via the FK; just drop the section.
  await sql`DELETE FROM public.discover_sections WHERE id = ${id}`;
}

/** Persist a new ordering. `orderedIds` is the section ids in their new order;
 *  each row's display_order is set to its index. */
export async function reorderDiscoverSections(sql: Sql, orderedIds: string[]): Promise<void> {
  await sql.begin(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx`UPDATE public.discover_sections SET display_order = ${i} WHERE id = ${orderedIds[i]!}`;
    }
  });
}
