-- Vibes live on the business (the "feel" of the spa), not per-deal — the same
-- shape as amenities: a jsonb array of slugs, e.g. ["clinical","luxe"]. Vendors
-- self-select 1-3; consumers filter spas by them on the map / discovery.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vibes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendors.vibes
  IS 'Array of vibe slugs (clinical/luxe/trendy/cozy/discreet/...) describing the spa''s feel. Set in vendor business settings; powers the consumer vibe filter.';

-- GIN index so the consumer "filter spas by vibe" containment query
-- (vibes @> '["luxe"]') stays fast as the vendor table grows.
CREATE INDEX IF NOT EXISTS vendors_vibes_gin ON public.vendors USING gin (vibes jsonb_path_ops);

-- Backfill the seeded demo spas with sensible vibes (derived from their
-- descriptions) so the filter has real data to land on out of the gate. Only
-- touches rows that are still empty, so vendors who later self-select aren't
-- clobbered if this ever re-runs.
UPDATE public.vendors AS v SET vibes = x.vibes
FROM (VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, '["clinical","high_end"]'::jsonb),  -- Glow Aesthetics La Jolla
  ('22222222-2222-2222-2222-222222222222'::uuid, '["wellness","clinical"]'::jsonb),  -- Glow House Wellness
  ('33333333-3333-3333-3333-333333333333'::uuid, '["clinical","cozy"]'::jsonb),      -- Skin Studio Hillcrest
  ('44444444-4444-4444-4444-444444444444'::uuid, '["wellness","trendy"]'::jsonb),    -- NAD Lounge SD
  ('55555555-5555-5555-5555-555555555555'::uuid, '["trendy","cozy"]'::jsonb),        -- Pacific Beach Aesthetics
  ('66666666-6666-6666-6666-666666666666'::uuid, '["wellness","luxe"]'::jsonb),      -- Encinitas Glow Co
  ('77777777-7777-7777-7777-777777777777'::uuid, '["fast","trendy"]'::jsonb),        -- Downtown SD Skin Bar
  ('88888888-8888-8888-8888-888888888888'::uuid, '["trendy","clinical"]'::jsonb)     -- North Park Body Lab
) AS x(id, vibes)
WHERE v.id = x.id AND v.vibes = '[]'::jsonb;
