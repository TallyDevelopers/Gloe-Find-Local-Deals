-- ============================================================
-- DISCOVER EDITORIAL SECTIONS (GLO-27)
-- ============================================================
-- A merchandising layer the founder edits, sitting ON TOP of the existing
-- category taxonomy. Each section has a warm, benefit-led TAGLINE that REPLACES
-- the dry category noun on the home (All) rail, and can pool deals from one OR
-- several categories under that single line. Source of truth = DB, admin-
-- editable (mirrors platform_fees / trending config — no code release to change
-- copy). service_categories is untouched; sections REFERENCE it.

CREATE TABLE public.discover_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The cute heading shown on the rail (replaces the category label entirely).
  tagline text NOT NULL,
  -- Admin-set tile art for the section. A multi-category section has no single
  -- category slug to derive a curated image from, so the founder art-directs it
  -- here. Null → client falls back to a deal photo.
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.discover_sections IS
  'Editorial home-feed sections (GLO-27): admin-authored taglines that pool 1..N categories into one rail. Replaces the one-rail-per-category default when any active section exists.';

CREATE TRIGGER discover_sections_set_updated_at
  BEFORE UPDATE ON public.discover_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Join: a section pulls deals from many categories. FK to service_categories.id
-- (not slug) for referential integrity — deleting a category cascades the link
-- out of the section rather than leaving a dangling slug.
CREATE TABLE public.discover_section_categories (
  section_id uuid NOT NULL REFERENCES public.discover_sections(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  -- Order categories within a section, if it ever matters for tie-breaks.
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, category_id)
);

CREATE INDEX discover_section_categories_section_idx
  ON public.discover_section_categories (section_id);

-- ── RLS: public reads active sections; writes are admin-only (the API connects
-- as the table owner, which bypasses RLS, so admin CRUD goes through the tRPC
-- adminProcedure guard rather than a DB policy — same as the other admin-tuned
-- config tables). Mirror the service_categories public-select-on-active shape.
ALTER TABLE public.discover_sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discover_section_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY discover_sections_public_select ON public.discover_sections
  FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY discover_section_categories_public_select ON public.discover_section_categories
  FOR SELECT TO anon, authenticated USING (true);
