-- Comprehensive treatment taxonomy (deep-dive seed).
-- Additive only: ON CONFLICT DO NOTHING, never touches existing rows, so
-- anything an admin renamed/hid in god mode stays as they left it.
-- New rows start at display_order 30 to sort after the original curated set.

-- ─── Injectables ───
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('lip-filler',          'Lip Filler',                          'syringe', 30),
  ('cheek-filler',        'Cheek Filler',                        'syringe', 31),
  ('chin-jawline-filler', 'Chin & Jawline Filler',               'syringe', 32),
  ('under-eye-filler',    'Under-Eye / Tear Trough Filler',      'syringe', 33),
  ('lip-flip',            'Lip Flip',                            'units',   34),
  ('masseter-botox',      'Masseter Botox (TMJ / Slimming)',     'units',   35),
  ('hyperhidrosis-botox', 'Botox for Sweating (Hyperhidrosis)',  'units',   36),
  ('trap-botox',          'Trap / “Barbie” Botox',               'units',   37),
  ('kybella',             'Kybella (Double Chin)',               'vial',    38),
  ('radiesse',            'Radiesse',                            'syringe', 39),
  ('restylane-l',         'Restylane-L',                         'syringe', 40),
  ('restylane-defyne',    'Restylane Defyne',                    'syringe', 41),
  ('restylane-refyne',    'Restylane Refyne',                    'syringe', 42),
  ('rha-2',               'RHA 2',                               'syringe', 43),
  ('rha-4',               'RHA 4',                               'syringe', 44),
  ('versa',               'Revanesse Versa',                     'syringe', 45),
  ('belotero',            'Belotero',                            'syringe', 46),
  ('skinvive',            'SkinVive',                            'syringe', 47),
  ('prf-ezgel',           'PRF / EZ Gel',                        'syringe', 48),
  ('pdo-threads',         'PDO Thread Lift',                     'session', 49),
  ('filler-dissolving',   'Filler Dissolving (Hyaluronidase)',   'session', 50)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'injectables'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── Skin ───
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('dermaplaning',       'Dermaplaning',                   'session', 30),
  ('signature-facial',   'Signature / Custom Facial',      'session', 31),
  ('diamondglow',        'DiamondGlow',                    'session', 32),
  ('glo2facial',         'Glo2Facial (Geneo)',             'session', 33),
  ('oxygen-facial',      'Oxygen Facial',                  'session', 34),
  ('prp-facial',         'PRP Facial (Vampire Facial)',    'session', 35),
  ('vi-peel',            'VI Peel',                        'session', 36),
  ('perfect-derma-peel', 'The Perfect Derma Peel',         'session', 37),
  ('biorepeel',          'BioRePeel',                      'session', 38),
  ('jessner-peel',       'Jessner Peel',                   'session', 39),
  ('microdermabrasion',  'Microdermabrasion',              'session', 40),
  ('vivace',             'Vivace RF Microneedling',        'session', 41),
  ('potenza',            'Potenza RF Microneedling',       'session', 42),
  ('exosomes',           'Exosome Therapy (Add-On)',       'session', 43),
  ('led-light-therapy',  'LED Light Therapy',              'session', 44),
  ('plasma-fibroblast',  'Plasma Fibroblast / Jet Plasma', 'session', 45),
  ('acne-facial',        'Acne Treatment Facial',          'session', 46),
  ('back-facial',        'Back Facial',                    'session', 47)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'skin'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── Laser ───
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('co2-laser',            'CO2 Laser Resurfacing (CoolPeel)', 'session', 30),
  ('fraxel',               'Fraxel',                           'session', 31),
  ('clear-brilliant',      'Clear + Brilliant',                'session', 32),
  ('erbium-laser',         'Erbium Laser Resurfacing',         'session', 33),
  ('pico-laser',           'Pico Laser (PicoSure)',            'session', 34),
  ('laser-genesis',        'Laser Genesis',                    'session', 35),
  ('vbeam',                'Vbeam / Vascular Laser',           'session', 36),
  ('aerolase',             'Aerolase',                         'session', 37),
  ('laser-tattoo-removal', 'Laser Tattoo Removal',             'session', 38)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'laser'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── Weight Loss ───
-- NOTE: semaglutide/tirzepatide rows already exist but are deactivated; this
-- migration deliberately leaves them as-is (reactivate in god mode if wanted).
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('lipo-b12-shot',         'Lipotropic / MIC-B12 Shot',         'shot',    30),
  ('weight-loss-program',   'Medical Weight Loss Program',       'month',   31),
  ('body-composition-scan', 'Body Composition Scan (InBody)',    'session', 32),
  ('phentermine',           'Appetite Suppressant (Phentermine)','month',   33)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'weight-loss'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── Body & Contouring ───
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('emsculpt',             'Emsculpt NEO',                          'session', 30),
  ('trusculpt',            'truSculpt',                             'session', 31),
  ('sculpsure',            'SculpSure',                             'session', 32),
  ('cellulite-treatment',  'Cellulite Treatment (Avéli / QWO)',     'session', 33),
  ('body-skin-tightening', 'Body Skin Tightening (RF / Ultrasound)','session', 34),
  ('emsella',              'Emsella (Pelvic Floor)',                'session', 35),
  ('lymphatic-massage',    'Lymphatic Drainage Massage',            'session', 36)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'body'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── IV Therapy (wellness) ───
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('glutathione-iv',       'Glutathione IV / Push',   'session', 30),
  ('vitamin-c-iv',         'High-Dose Vitamin C IV',  'session', 31),
  ('immunity-iv',          'Immunity IV',             'session', 32),
  ('beauty-iv',            'Beauty / Glow IV',        'session', 33),
  ('energy-iv',            'Energy IV',               'session', 34),
  ('hangover-iv',          'Hangover Recovery IV',    'session', 35),
  ('athletic-recovery-iv', 'Athletic Recovery IV',    'session', 36),
  ('nad-shot',             'NAD+ Injection',          'shot',    37),
  ('glutathione-shot',     'Glutathione Shot',        'shot',    38),
  ('vitamin-d-shot',       'Vitamin D Shot',          'shot',    39)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'wellness'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── Hormones & Peptides ───
-- The category was live with ZERO active treatments (the old generic
-- 'hormones' row is deactivated). This seeds the real menu.
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('hrt-women',        'Hormone Therapy — Women (BHRT)',  'month',   30),
  ('trt-men',          'Testosterone Therapy — Men (TRT)','month',   31),
  ('hormone-pellets',  'Hormone Pellet Therapy',          'session', 32),
  ('peptide-therapy',  'Peptide Therapy',                 'month',   33),
  ('sermorelin',       'Sermorelin / CJC-1295',           'month',   34),
  ('bpc-157',          'BPC-157',                         'month',   35),
  ('hormone-consult',  'Hormone Consult + Labs',          'consult', 36)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'hormones-peptides'
ON CONFLICT (category_id, slug) DO NOTHING;

-- ─── Lashes & Eyes (other) ───
INSERT INTO public.service_subtypes (category_id, slug, display_name, unit_label, display_order)
SELECT c.id, v.slug, v.name, v.unit, v.ord
FROM (VALUES
  ('lash-extensions',    'Lash Extensions (Full Set)', 'set',     30),
  ('lash-fill',          'Lash Fill',                  'session', 31),
  ('lash-lift-tint',     'Lash Lift & Tint',           'session', 32),
  ('brow-lamination',    'Brow Lamination',            'session', 33),
  ('brow-shape-tint',    'Brow Shaping & Tint',        'session', 34),
  ('microblading',       'Microblading / Nano Brows',  'session', 35),
  ('powder-brows',       'Powder / Ombré Brows',       'session', 36),
  ('permanent-eyeliner', 'Permanent Eyeliner',         'session', 37)
) AS v(slug, name, unit, ord)
JOIN public.service_categories c ON c.slug = 'other'
ON CONFLICT (category_id, slug) DO NOTHING;
