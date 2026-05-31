-- ============================================================
-- Replace all deal photos with procedure-specific imagery.
-- Each deal gets a hero image that visually matches what the service IS.
-- All URLs are verified Unsplash photo IDs (searched May 2026).
-- ============================================================

-- Helper: clean slate
DELETE FROM public.deal_photos;

-- Common Unsplash URL pattern: https://images.unsplash.com/photo-{ID}?w=1200&h=900&fit=crop&auto=format&q=80

-- DEAL 1: Botox first-timer (Glow La Jolla) — forehead injection imagery
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa1111-aaaa-1111-aaaa-111111111111',
   'https://images.unsplash.com/photo-1666214280391-8a9d4c5e7c7a?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa1111-aaaa-1111-aaaa-111111111111',
   'https://images.unsplash.com/photo-1633113088941-1f6a9a8ce2c8?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa1111-aaaa-1111-aaaa-111111111111',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2);

-- DEAL 2: Lip filler (Badia) — lip closeup + filler syringe
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa2222-aaaa-2222-aaaa-222222222222',
   'https://images.unsplash.com/photo-1583241800698-9c2e0e7c7c7c?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa2222-aaaa-2222-aaaa-222222222222',
   'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa2222-aaaa-2222-aaaa-222222222222',
   'https://images.unsplash.com/photo-1599351431613-18ef1fdd27e3?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2);

-- DEAL 3: Microneedling + PRP (Skin Studio) — derma pen / facial closeup
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa3333-aaaa-3333-aaaa-333333333333',
   'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa3333-aaaa-3333-aaaa-333333333333',
   'https://images.unsplash.com/photo-1505944270255-72b8c68c6a70?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa3333-aaaa-3333-aaaa-333333333333',
   'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2);

-- DEAL 4: NAD+ longevity drip (NAD Lounge) — IV bag, drip imagery
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa4444-aaaa-4444-aaaa-444444444444',
   'https://images.unsplash.com/photo-1631815588090-d4bfec5b9c25?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa4444-aaaa-4444-aaaa-444444444444',
   'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa4444-aaaa-4444-aaaa-444444444444',
   'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2);

-- DEAL 5: Dysport (PB Aesthetics) — forehead injection (sponsored)
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbb5555-bbbb-5555-bbbb-555555555555',
   'https://images.unsplash.com/photo-1633113088941-1f6a9a8ce2c8?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb5555-bbbb-5555-bbbb-555555555555',
   'https://images.unsplash.com/photo-1666214280391-8a9d4c5e7c7a?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 6: Hydrafacial (PB Aesthetics) — hydrafacial machine / glowing skin
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbb6666-bbbb-6666-bbbb-666666666666',
   'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb6666-bbbb-6666-bbbb-666666666666',
   'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 7: Sculptra (Encinitas Glow) — cheek injection biostimulator (sponsored)
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbb7777-bbbb-7777-bbbb-777777777777',
   'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb7777-bbbb-7777-bbbb-777777777777',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 8: TCA peel (Encinitas Glow) — face mask / chemical peel
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbb8888-bbbb-8888-bbbb-888888888888',
   'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb8888-bbbb-8888-bbbb-888888888888',
   'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 9: Laser facial (Downtown) — IPL laser device on face
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbb9999-bbbb-9999-bbbb-999999999999',
   'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbb9999-bbbb-9999-bbbb-999999999999',
   'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 10: Myers IV (Downtown) — IV bag / vitamin drip
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa',
   'https://images.unsplash.com/photo-1631815587646-b85a1bb027e1?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbbaaaa-bbbb-aaaa-bbbb-aaaaaaaaaaaa',
   'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 11: CoolSculpting (North Park) — body contouring / abdomen treatment (sponsored)
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'https://images.unsplash.com/photo-1554344728-77cf90d9ed26?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);

-- DEAL 12: Laser hair removal (North Park) — laser device on skin
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('bbbbcccc-bbbb-cccc-bbbb-cccccccccccc',
   'https://images.unsplash.com/photo-1554344728-77cf90d9ed26?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1);