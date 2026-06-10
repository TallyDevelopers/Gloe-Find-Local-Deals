-- "Surgery result without the surgery" treatments — the marketable hooks
-- (liquid nose job, non-surgical facelift, Nefertiti lift, salmon-DNA facial).
-- Additive only, same pattern as 20260609090000.

INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('liquid-rhinoplasty',  'Liquid Rhinoplasty (Non-Surgical Nose Job)', 'syringe', 51),
  ('temple-filler',       'Temple Filler',                              'syringe', 52),
  ('hand-filler',         'Hand Rejuvenation Filler',                   'syringe', 53),
  ('botox-brow-lift',     'Botox Brow Lift',                            'units',   54),
  ('nefertiti-neck-lift', 'Nefertiti Neck Lift (Botox)',                'units',   55),
  ('hyperdilute-radiesse','Hyperdilute Radiesse (Biostimulator)',       'vial',    56),
  ('polynucleotides',     'Polynucleotides / Salmon DNA (Rejuran)',     'syringe', 57)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'injectables'
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('ultherapy',            'Ultherapy (Non-Surgical Lift)', 'session', 48),
  ('sofwave',              'Sofwave',                       'session', 49),
  ('prp-hair-restoration', 'PRP Hair Restoration',          'session', 50)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'skin'
ON CONFLICT (category_id, slug) DO NOTHING;
