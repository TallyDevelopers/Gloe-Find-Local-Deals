-- Replace likely-broken Unsplash IDs with verified working ones.
-- These are aesthetic / wellness / skincare photos confirmed to exist.

-- Botox deal — was 1570172619644 (dead) — replace gallery
DELETE FROM public.deal_photos WHERE deal_id = 'aaaa1111-aaaa-1111-aaaa-111111111111';
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&h=900&fit=crop&auto=format&q=80',  'gallery', 1),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 3);

-- Lip filler — was 1614859275019 (dead) — replace gallery
DELETE FROM public.deal_photos WHERE deal_id = 'aaaa2222-aaaa-2222-aaaa-222222222222';
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&h=900&fit=crop&auto=format&q=80',  'gallery', 2);

-- Microneedling — was 1570554886111 (dead) — replace
DELETE FROM public.deal_photos WHERE deal_id = 'aaaa3333-aaaa-3333-aaaa-333333333333';
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2);

-- NAD — replace
DELETE FROM public.deal_photos WHERE deal_id = 'aaaa4444-aaaa-4444-aaaa-444444444444';
INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&h=900&fit=crop&auto=format&q=80',  'gallery', 2);