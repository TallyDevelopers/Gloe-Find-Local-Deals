-- 8 new deals across the new + existing vendors
INSERT INTO public.deals (
  id, vendor_id, category_id, subtype_id,
  title, description, whats_included,
  status, expires_at, restrictions, is_sponsored
) VALUES
  -- 5: Dysport at PB (SPONSORED)
  (
    'bbbb5555-bbbb-5555-bbbb-555555555555',
    '55555555-5555-5555-5555-555555555555',
    (SELECT id FROM public.service_categories WHERE slug='botox'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='botox' AND s.slug='dysport'),
    'Dysport — softer + faster onset',
    'Dysport diffuses more naturally than Botox for first-time clients. Faster onset (2-3 days).',
    '["Dysport injections","Free consultation","Personalized plan","Touch-up included"]'::jsonb,
    'active', now() + interval '5 days',
    '["New clients only","Cannot combine with other offers"]'::jsonb,
    true
  ),
  -- 6: Hydrafacial at PB
  (
    'bbbb6666-bbbb-6666-bbbb-666666666666',
    '55555555-5555-5555-5555-555555555555',
    (SELECT id FROM public.service_categories WHERE slug='skin'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='skin' AND s.slug='hydrafacial'),
    'Hydrafacial — signature glow',
    'Deep-cleansing 3-step Hydrafacial. Instant glow with zero downtime. Perfect before an event.',
    '["3-step Hydrafacial","LED finisher","Booster serum","Aftercare kit"]'::jsonb,
    'active', now() + interval '14 days',
    '["Cannot combine with other offers"]'::jsonb,
    false
  ),
  -- 7: Sculptra at Encinitas (SPONSORED)
  (
    'bbbb7777-bbbb-7777-bbbb-777777777777',
    '66666666-6666-6666-6666-666666666666',
    (SELECT id FROM public.service_categories WHERE slug='filler'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='filler' AND s.slug='sculptra'),
    'Sculptra biostimulator — collagen boost',
    'Sculptra rebuilds your own collagen over months. Subtle, long-lasting volume restoration.',
    '["Sculptra vials","Consultation + treatment plan","Two follow-up sessions"]'::jsonb,
    'active', now() + interval '21 days',
    '["Consultation required","Series of 2-3 sessions recommended"]'::jsonb,
    true
  ),
  -- 8: Chemical peel at Encinitas
  (
    'bbbb8888-bbbb-8888-bbbb-888888888888',
    '66666666-6666-6666-6666-666666666666',
    (SELECT id FROM public.service_categories WHERE slug='skin'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='skin' AND s.slug='chemical-peel'),
    'TCA chemical peel — texture reset',
    'Medical-grade TCA peel for sun damage, fine lines, and texture. 5-7 day downtime.',
    '["TCA peel","Post-peel kit","Two-week follow-up"]'::jsonb,
    'active', now() + interval '10 days',
    '["Not for active acne or pregnancy","No sun exposure for 2 weeks post"]'::jsonb,
    false
  ),
  -- 9: Laser facial at Downtown
  (
    'bbbb9999-bbbb-9999-bbbb-999999999999',
    '77777777-7777-7777-7777-777777777777',
    (SELECT id FROM public.service_categories WHERE slug='skin'),
    NULL,
    'Lunchtime laser facial',
    'Quick 30-min photofacial. Reduces redness and brightens in one session. No downtime.',
    '["IPL photofacial","Cooling mask","SPF top-up"]'::jsonb,
    'active', now() + interval '7 days',
    '["Bring sunglasses","Avoid sun 48hrs prior"]'::jsonb,
    false
  ),
  -- 10: IV Myers at Downtown
  (
    'bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa',
    '77777777-7777-7777-7777-777777777777',
    (SELECT id FROM public.service_categories WHERE slug='wellness'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='wellness' AND s.slug='myers-iv'),
    'Myers cocktail IV — energy + immunity',
    'Classic Myers vitamin + mineral IV. Energy, hydration, immunity boost. 45-min infusion.',
    '["Myers cocktail IV","B12 boost","Hydration tracker","Recovery drink"]'::jsonb,
    'active', now() + interval '9 days',
    '["Medical screening required","21+ only"]'::jsonb,
    false
  ),
  -- 11: CoolSculpting at North Park (SPONSORED)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '88888888-8888-8888-8888-888888888888',
    (SELECT id FROM public.service_categories WHERE slug='body'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='body' AND s.slug='coolsculpting'),
    'CoolSculpting — abdomen + flanks',
    'Freeze unwanted fat with CoolSculpting Elite. Permanent results in 1-3 sessions per area.',
    '["CoolSculpting Elite cycles","Body contouring assessment","Compression garment"]'::jsonb,
    'active', now() + interval '15 days',
    '["Not for pregnancy","Maintain stable weight for best results"]'::jsonb,
    true
  ),
  -- 12: Laser hair removal at North Park
  (
    'bbbbcccc-bbbb-cccc-bbbb-cccccccccccc',
    '88888888-8888-8888-8888-888888888888',
    (SELECT id FROM public.service_categories WHERE slug='body'),
    (SELECT s.id FROM public.service_subtypes s JOIN public.service_categories c ON c.id=s.category_id WHERE c.slug='body' AND s.slug='laser-hair-removal'),
    'Laser hair removal — full body',
    'Full-body laser hair removal package. 6-session series for permanent reduction.',
    '["6 sessions","Cooling gel + post-care","Touch-up year 1"]'::jsonb,
    'active', now() + interval '30 days',
    '["Skin must be free of recent tans"]'::jsonb,
    false
  );

-- Variants for the new deals
INSERT INTO public.deal_variants (deal_id, label, unit_count, unit_label, display_order, original_price_cents, deal_price_cents, spots_total, spots_claimed) VALUES
  ('bbbb5555-bbbb-5555-bbbb-555555555555', '40 units', 40, 'units', 1, 24000, 18000, 25, 8),
  ('bbbb5555-bbbb-5555-bbbb-555555555555', '60 units', 60, 'units', 2, 36000, 27000, 15, 5),
  ('bbbb5555-bbbb-5555-bbbb-555555555555', '100 units', 100, 'units', 3, 60000, 42000, 8, 2),
  ('bbbb6666-bbbb-6666-bbbb-666666666666', 'Single session', NULL, NULL, 1, 25000, 17500, NULL, 0),
  ('bbbb6666-bbbb-6666-bbbb-666666666666', '3-session glow pack', 3, 'sessions', 2, 75000, 49500, 12, 4),
  ('bbbb7777-bbbb-7777-bbbb-777777777777', '1 vial', 1, 'vial', 1, 90000, 69000, 10, 3),
  ('bbbb7777-bbbb-7777-bbbb-777777777777', '2 vials', 2, 'vials', 2, 170000, 129000, 6, 1),
  ('bbbb8888-bbbb-8888-bbbb-888888888888', 'Single peel', NULL, NULL, 1, 45000, 32000, NULL, 0),
  ('bbbb9999-bbbb-9999-bbbb-999999999999', 'Single session', NULL, NULL, 1, 28000, 19900, NULL, 0),
  ('bbbb9999-bbbb-9999-bbbb-999999999999', '3-pack', 3, 'sessions', 2, 84000, 54000, 20, 7),
  ('bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa', 'Myers IV', NULL, NULL, 1, 25000, 17500, NULL, 0),
  ('bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa', 'Myers + B12 + glutathione', NULL, NULL, 2, 38000, 27500, 15, 4),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '1 cycle', 1, 'cycle', 1, 80000, 59900, NULL, 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2 cycles', 2, 'cycles', 2, 150000, 109900, 8, 2),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '4 cycles', 4, 'cycles', 3, 280000, 199900, 4, 1),
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc', 'Small area (under arms / face)', NULL, NULL, 1, 45000, 29900, NULL, 0),
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc', 'Medium area (legs / arms)', NULL, NULL, 2, 90000, 59900, NULL, 0),
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc', 'Full body', NULL, NULL, 3, 240000, 149900, 10, 3);

-- Photos for new deals — every deal gets a hero
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbb5555-bbbb-5555-bbbb-555555555555', 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb5555-bbbb-5555-bbbb-555555555555', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbb6666-bbbb-6666-bbbb-666666666666', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb6666-bbbb-6666-bbbb-666666666666', 'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbb7777-bbbb-7777-bbbb-777777777777', 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb7777-bbbb-7777-bbbb-777777777777', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbb8888-bbbb-8888-bbbb-888888888888', 'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb8888-bbbb-8888-bbbb-888888888888', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbb9999-bbbb-9999-bbbb-999999999999', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb9999-bbbb-9999-bbbb-999999999999', 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://images.unsplash.com/photo-1554344728-77cf90d9ed26?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc', 'https://images.unsplash.com/photo-1554344728-77cf90d9ed26?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);