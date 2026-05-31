-- Merge Botox+Filler -> Injectables, add Laser + Other, drop Hair.

-- 1. Rename botox -> injectables (keeps id + its deals)
UPDATE public.service_categories
SET slug = 'injectables', display_name = 'Injectables', display_order = 1, is_unit_based = true
WHERE slug = 'botox';

-- 2. Move filler into injectables
DO $$
DECLARE
  inj_id uuid;
  filler_id uuid;
BEGIN
  SELECT id INTO inj_id FROM public.service_categories WHERE slug = 'injectables';
  SELECT id INTO filler_id FROM public.service_categories WHERE slug = 'filler';

  IF filler_id IS NOT NULL THEN
    UPDATE public.service_subtypes SET category_id = inj_id WHERE category_id = filler_id;
    UPDATE public.deals SET category_id = inj_id WHERE category_id = filler_id;
    -- For vendor_services: delete filler rows where the vendor already has injectables,
    -- then move the rest.
    DELETE FROM public.vendor_services vs1
    WHERE vs1.category_id = filler_id
      AND EXISTS (
        SELECT 1 FROM public.vendor_services vs2
        WHERE vs2.vendor_id = vs1.vendor_id AND vs2.category_id = inj_id
      );
    UPDATE public.vendor_services SET category_id = inj_id WHERE category_id = filler_id;
    DELETE FROM public.service_categories WHERE id = filler_id;
  END IF;
END $$;

-- 3. Drop Hair
DELETE FROM public.service_subtypes WHERE category_id = (SELECT id FROM public.service_categories WHERE slug = 'hair');
DELETE FROM public.vendor_services WHERE category_id = (SELECT id FROM public.service_categories WHERE slug = 'hair');
DELETE FROM public.service_categories WHERE slug = 'hair';

-- 4. Add Laser + Other
INSERT INTO public.service_categories (slug, display_name, icon, is_unit_based, display_order, active)
VALUES
  ('laser', 'Laser', '✨', false, 3, true),
  ('other', 'Other', '○', false, 6, true)
ON CONFLICT (slug) DO NOTHING;

-- 5. Re-order
UPDATE public.service_categories SET display_order = 1 WHERE slug = 'injectables';
UPDATE public.service_categories SET display_order = 2 WHERE slug = 'skin';
UPDATE public.service_categories SET display_order = 3 WHERE slug = 'laser';
UPDATE public.service_categories SET display_order = 4 WHERE slug = 'body';
UPDATE public.service_categories SET display_order = 5 WHERE slug = 'wellness';
UPDATE public.service_categories SET display_order = 6 WHERE slug = 'other';

-- 6. New subtypes
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, sub.slug, sub.display_name, sub.unit_label, sub.display_order FROM (
  VALUES
    ('laser',     'bbl',         'BBL / IPL',                 'session', 1),
    ('laser',     'halo',        'HALO',                      'session', 2),
    ('laser',     'moxi',        'Moxi',                      'session', 3),
    ('laser',     'laser-hair',  'Laser Hair Removal',        'session', 4),
    ('skin',      'morpheus8',   'Morpheus8 RF',              'session', 10),
    ('wellness',  'semaglutide', 'Weight Loss (Semaglutide)', 'month',   10),
    ('wellness',  'tirzepatide', 'Weight Loss (Tirzepatide)', 'month',   11),
    ('wellness',  'hormones',    'Hormone Therapy',           'month',   12),
    ('other',     'latisse',     'Latisse (lashes)',          'kit',     1),
    ('other',     'upneeq',      'Upneeq (eyelid lift)',      'month',   2)
) AS sub(cat_slug, slug, display_name, unit_label, display_order)
JOIN public.service_categories c ON c.slug = sub.cat_slug
ON CONFLICT (category_id, slug) DO NOTHING;