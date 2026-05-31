-- Helper to build Unsplash URLs
-- (inlining the URLs since plpgsql functions are overkill for seeds)

INSERT INTO public.deal_photos (deal_id, url, photo_type, display_order) VALUES
  -- Glow La Jolla — Botox gallery
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&h=900&fit=crop&auto=format&q=80',  'gallery', 1),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2),
  ('aaaa1111-aaaa-1111-aaaa-111111111111', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 3),

  -- Badia — Lip filler gallery
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'https://images.unsplash.com/photo-1614859275019-1e9b8e5e3e8c?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&h=900&fit=crop&auto=format&q=80',  'gallery', 2),

  -- Skin Studio — microneedling gallery
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'https://images.unsplash.com/photo-1570554886111-e80fcca6a029?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa3333-aaaa-3333-aaaa-333333333333', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2),

  -- NAD Lounge — gallery
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&h=900&fit=crop&auto=format&q=80', 'hero', 0),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 1),
  ('aaaa4444-aaaa-4444-aaaa-444444444444', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=1200&h=900&fit=crop&auto=format&q=80', 'gallery', 2);

-- Videos — only Glow La Jolla has any so we can verify the auto-hide
INSERT INTO public.deal_videos (deal_id, video_url, thumbnail_url, caption, duration_seconds, display_order) VALUES
  (
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    'https://example.com/videos/glow-1.mp4',
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&h=1000&fit=crop&auto=format&q=80',
    'Madison talks through what to expect for first-timers.',
    48, 1
  ),
  (
    'aaaa1111-aaaa-1111-aaaa-111111111111',
    'https://example.com/videos/glow-2.mp4',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=1000&fit=crop&auto=format&q=80',
    'Behind the scenes — our injection technique.',
    72, 2
  );