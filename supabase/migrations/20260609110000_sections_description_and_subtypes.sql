-- Editorial sections, part 2: a typed DESCRIPTION under the tagline, and
-- TREATMENT-level targeting. A section can now pool whole categories AND/OR
-- specific treatments ("Liquid Rhinoplasty") — so the founder can merchandise
-- a single trend ("Rhinoplasty without living with it forever") instead of
-- being stuck at category granularity.

ALTER TABLE public.discover_sections
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.discover_sections.description IS
  'Optional admin-typed copy shown under the tagline on the rail.';

-- Join: a section pulls deals tagged with specific treatments. Mirrors
-- discover_section_categories exactly (FK by id, cascade both ways).
CREATE TABLE IF NOT EXISTS public.discover_section_subtypes (
  section_id uuid NOT NULL REFERENCES public.discover_sections(id) ON DELETE CASCADE,
  subtype_id uuid NOT NULL REFERENCES public.service_subtypes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (section_id, subtype_id)
);

CREATE INDEX IF NOT EXISTS discover_section_subtypes_section_idx
  ON public.discover_section_subtypes (section_id);

ALTER TABLE public.discover_section_subtypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY discover_section_subtypes_public_select ON public.discover_section_subtypes
  FOR SELECT TO anon, authenticated USING (true);
