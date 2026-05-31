-- ============================================================
-- DEALS (one per vendor for v0)
-- ============================================================
INSERT INTO public.deals (
  id, vendor_id, category_id, subtype_id,
  title, description, whats_included,
  status, expires_at, restrictions
) VALUES
  -- Deal 1: Botox at Glow La Jolla
  (
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    '11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.service_categories WHERE slug = 'botox'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id = s.category_id WHERE c.slug='botox' AND s.slug='botox'),
    'Botox — first-timer special',
    'Soften forehead lines, glabella, and crow''s feet with precise Botox injections from a licensed nurse practitioner. New clients only.',
    '["Botox injections","Complimentary 15-min consultation","Personalized treatment plan","2-week follow-up"]'::jsonb,
    'active', now() + interval '3 days',
    '["New clients only","Cannot combine with other offers","Consultation required before treatment"]'::jsonb
  ),
  -- Deal 2: Lip filler at Badia
  (
    'aaaa2222-aaaa-2222-aaaa-222222222222',
    '22222222-2222-2222-2222-222222222222',
    (SELECT id FROM public.service_categories WHERE slug='filler'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='filler' AND s.slug='juvederm-volbella'),
    'Lip filler — Juvederm Volbella',
    'Subtle, natural-looking lip enhancement with Juvederm Volbella. Ideal for definition and gentle volume. Results last 12+ months.',
    '["Juvederm Volbella filler","Pre-treatment numbing","Aftercare kit","2-week touch-up if needed"]'::jsonb,
    'active', now() + interval '6 days',
    '["Cannot combine with other offers","Must redeem within 30 days of booking"]'::jsonb
  ),
  -- Deal 3: Microneedling at Skin Studio
  (
    'aaaa3333-aaaa-3333-aaaa-333333333333',
    '33333333-3333-3333-3333-333333333333',
    (SELECT id FROM public.service_categories WHERE slug='skin'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='skin' AND s.slug='microneedling-prp'),
    'Microneedling + PRP',
    '60-minute treatment combining microneedling with platelet-rich plasma to stimulate collagen and brighten skin. Series of 3 recommended.',
    '["60-min microneedling","PRP draw and application","LED light therapy finisher","Take-home recovery serum"]'::jsonb,
    'active', now() + interval '11 days',
    '["Not for active acne or pregnancy"]'::jsonb
  ),
  -- Deal 4: NAD+ at NAD Lounge
  (
    'aaaa4444-aaaa-4444-aaaa-444444444444',
    '44444444-4444-4444-4444-444444444444',
    (SELECT id FROM public.service_categories WHERE slug='wellness'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='wellness' AND s.slug='nad-iv'),
    'NAD+ longevity drip',
    'Recharge your cellular energy with a NAD+ infusion. Promotes mental clarity, mitochondrial repair, and recovery.',
    '["NAD+ IV infusion (~90 min)","Hydration co-drip","Quiet recovery suite","Post-drip electrolytes"]'::jsonb,
    'active', now() + interval '2 days',
    '["Medical screening required","21+ only"]'::jsonb
  );

-- ============================================================
-- DEAL VARIANTS — these are the chips user picks from
-- ============================================================
INSERT INTO public.deal_variants (deal_id, label, unit_count, unit_label, display_order, original_price_cents, deal_price_cents, spots_total, spots_claimed) VALUES
  -- Botox: 20 / 40 / 60 units
  ('aaaa1111-aaaa-1111-aaaa-111111111111', '20 units', 20, 'units', 1, 28000, 20000, 20, 6),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', '40 units', 40, 'units', 2, 52000, 38000, 15, 4),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', '60 units', 60, 'units', 3, 76000, 54000, 10, 2),

  -- Filler: 1 / 2 syringes
  ('aaaa2222-aaaa-2222-aaaa-222222222222', '1 syringe', 1, 'syringe', 1, 75000, 59000, 10, 3),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', '2 syringes', 2, 'syringes', 2, 140000, 109000, 6, 2),

  -- Microneedling: single / 3-pack
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'Single session', NULL, NULL, 1, 65000, 45000, NULL, 0),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', '3-session series', 3, 'sessions', 2, 195000, 120000, 8, 3),

  -- NAD: 250 / 500 / 1000 mg
  ('aaaa4444-aaaa-4444-aaaa-444444444444', '250mg', 250, 'mg', 1, 32000, 24900, NULL, 0),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', '500mg', 500, 'mg', 2, 55000, 39900, 8, 4),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', '1000mg', 1000, 'mg', 3, 99000, 74900, 4, 1);