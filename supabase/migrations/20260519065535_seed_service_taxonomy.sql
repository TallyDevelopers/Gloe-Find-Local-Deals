-- ============================================================
-- SERVICE CATEGORIES + SUBTYPES
-- These mirror what we hardcoded in the app — now they live in the DB
-- and admins can edit / add without code deploys.
-- ============================================================
INSERT INTO public.service_categories (slug, display_name, icon, is_unit_based, display_order) VALUES
  ('botox', 'Botox', '💉', true, 1),
  ('filler', 'Filler', '💋', true, 2),
  ('skin', 'Skin', '✨', false, 3),
  ('body', 'Body', '🌿', false, 4),
  ('wellness', 'Wellness', '🌱', false, 5),
  ('hair', 'Hair', '💆', false, 6);

-- Subtypes by category
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, sub.slug, sub.display_name, sub.unit_label, sub.display_order FROM (
  VALUES
    ('botox',  'botox',     'Botox',    'units',    1),
    ('botox',  'dysport',   'Dysport',  'units',    2),
    ('botox',  'xeomin',    'Xeomin',   'units',    3),
    ('botox',  'jeuveau',   'Jeuveau',  'units',    4),
    ('botox',  'daxxify',   'Daxxify',  'units',    5),
    ('filler', 'juvederm-volbella', 'Juvederm Volbella', 'syringe', 1),
    ('filler', 'juvederm-voluma',   'Juvederm Voluma',   'syringe', 2),
    ('filler', 'restylane-kysse',   'Restylane Kysse',   'syringe', 3),
    ('filler', 'restylane-lyft',    'Restylane Lyft',    'syringe', 4),
    ('filler', 'rha-3',             'RHA 3',             'syringe', 5),
    ('filler', 'sculptra',          'Sculptra',          'vial',    6),
    ('skin',   'microneedling-prp', 'Microneedling + PRP', 'session', 1),
    ('skin',   'hydrafacial',       'Hydrafacial',         'session', 2),
    ('skin',   'chemical-peel',     'Chemical Peel',       'session', 3),
    ('body',   'coolsculpting',     'CoolSculpting',       'session', 1),
    ('body',   'laser-hair-removal','Laser Hair Removal',  'session', 2),
    ('wellness','nad-iv',           'NAD+ IV',             'mg',      1),
    ('wellness','myers-iv',         'Myers Cocktail IV',   'session', 2),
    ('wellness','semaglutide',      'Semaglutide',         'month',   3),
    ('hair',   'prp-hair',          'PRP Hair Restoration','session', 1)
) AS sub(cat_slug, slug, display_name, unit_label, display_order)
JOIN public.service_categories c ON c.slug = sub.cat_slug;