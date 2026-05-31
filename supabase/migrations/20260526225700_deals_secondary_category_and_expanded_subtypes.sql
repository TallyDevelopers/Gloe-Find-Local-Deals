
-- 1) Allow a deal to belong to a second category (primary + secondary).
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS secondary_category_id uuid
  REFERENCES public.service_categories(id);

CREATE INDEX IF NOT EXISTS deals_secondary_category_idx
  ON public.deals(secondary_category_id)
  WHERE secondary_category_id IS NOT NULL;

-- Primary and secondary must differ.
ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_categories_distinct;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_categories_distinct
  CHECK (secondary_category_id IS NULL OR secondary_category_id <> category_id);

-- 2) Optional helper text on a subtype (e.g. the weight-mgmt disclaimer).
ALTER TABLE public.service_subtypes
  ADD COLUMN IF NOT EXISTS helper_text text;

-- 3) Deactivate medication subtypes that violate the no-medication-as-product rule.
--    The 1 existing 'semaglutide' deal keeps its FK; new listings can't select it.
UPDATE public.service_subtypes
   SET active = false
 WHERE slug IN ('semaglutide', 'tirzepatide', 'hormones');

-- 4) Seed the new top-level treatment subtypes the founder requested.
--    Idempotent: keyed on (category_id, slug) via WHERE NOT EXISTS.

WITH cats AS (
  SELECT slug, id FROM public.service_categories
), to_seed (cat_slug, slug, display_name, unit_label, display_order, active, helper_text) AS (
  VALUES
    -- Injectables (Botox/Dysport/Xeomin already exist; add the Dermal filler bucket)
    ('injectables', 'dermal-filler',        'Dermal Filler',                      'syringe',  20,  TRUE,  NULL),

    -- Skin
    ('skin',        'facials-hydrafacial',  'Facials / Hydrafacial',              'session',  20,  TRUE,  NULL),
    ('skin',        'microneedling',        'Microneedling',                      'session',  21,  TRUE,  NULL),
    ('skin',        'rf-microneedling',     'RF Microneedling / Skin Tightening', 'session',  22,  TRUE,  NULL),

    -- Laser
    ('laser',       'ipl-laser-skin',       'IPL / Laser Skin Treatments',        'session',  20,  TRUE,  NULL),

    -- Body
    ('body',        'body-contouring',      'Body Contouring',                    'session',  20,  TRUE,  NULL),

    -- Wellness — consult, not medication
    ('wellness',    'b12-wellness-shots',   'B12 / Wellness Shots',               'shot',     20,  TRUE,  NULL),
    ('wellness',    'iv-hydration',         'IV Hydration',                       'session',  21,  TRUE,  NULL),
    ('wellness',    'medical-weight-mgmt-consult',
                                            'Medical Weight Management Consultation',
                                                                                  'consult',  22,  TRUE,
        'Medication eligibility and treatment options must be determined by a licensed provider.'),

    -- Beauty add-ons live under a NEW top-level 'beauty' category (created below),
    -- seeded inactive so they don't appear in the discover pills until enabled.
    ('beauty',      'brow-services',        'Brow Services',                      'session',  10,  FALSE, NULL),
    ('beauty',      'lash-services',        'Lash Services',                      'session',  11,  FALSE, NULL),
    ('beauty',      'waxing-sugaring',      'Waxing / Sugaring',                  'session',  12,  FALSE, NULL),
    ('beauty',      'spray-tans',           'Spray Tans',                         'session',  13,  FALSE, NULL),
    ('beauty',      'teeth-whitening',      'Teeth Whitening',                    'session',  14,  FALSE, NULL)
)
-- Create the 'beauty' category first if it's missing (inactive — hidden until flipped on).
INSERT INTO public.service_categories (slug, display_name, is_unit_based, display_order, active)
SELECT 'beauty', 'Beauty', FALSE, 7, FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.service_categories WHERE slug = 'beauty');

-- Now insert subtypes that don't already exist.
INSERT INTO public.service_subtypes
  (category_id, slug, display_name, unit_label, display_order, active, helper_text)
SELECT c.id, s.slug, s.display_name, s.unit_label, s.display_order, s.active, s.helper_text
FROM (
  VALUES
    ('injectables', 'dermal-filler',        'Dermal Filler',                      'syringe',  20,  TRUE,  NULL::text),
    ('skin',        'facials-hydrafacial',  'Facials / Hydrafacial',              'session',  20,  TRUE,  NULL),
    ('skin',        'microneedling',        'Microneedling',                      'session',  21,  TRUE,  NULL),
    ('skin',        'rf-microneedling',     'RF Microneedling / Skin Tightening', 'session',  22,  TRUE,  NULL),
    ('laser',       'ipl-laser-skin',       'IPL / Laser Skin Treatments',        'session',  20,  TRUE,  NULL),
    ('body',        'body-contouring',      'Body Contouring',                    'session',  20,  TRUE,  NULL),
    ('wellness',    'b12-wellness-shots',   'B12 / Wellness Shots',               'shot',     20,  TRUE,  NULL),
    ('wellness',    'iv-hydration',         'IV Hydration',                       'session',  21,  TRUE,  NULL),
    ('wellness',    'medical-weight-mgmt-consult',
                                            'Medical Weight Management Consultation',
                                                                                  'consult',  22,  TRUE,
        'Medication eligibility and treatment options must be determined by a licensed provider.'),
    ('beauty',      'brow-services',        'Brow Services',                      'session',  10,  FALSE, NULL),
    ('beauty',      'lash-services',        'Lash Services',                      'session',  11,  FALSE, NULL),
    ('beauty',      'waxing-sugaring',      'Waxing / Sugaring',                  'session',  12,  FALSE, NULL),
    ('beauty',      'spray-tans',           'Spray Tans',                         'session',  13,  FALSE, NULL),
    ('beauty',      'teeth-whitening',      'Teeth Whitening',                    'session',  14,  FALSE, NULL)
) AS s(cat_slug, slug, display_name, unit_label, display_order, active, helper_text)
JOIN public.service_categories c ON c.slug = s.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_subtypes ss
   WHERE ss.category_id = c.id AND ss.slug = s.slug
);
