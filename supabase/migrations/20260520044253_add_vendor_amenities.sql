-- Amenities live on the business (set once), not per-deal.
-- jsonb array of slugs, e.g. ["free_parking","wifi","wheelchair_accessible"]
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendors.amenities
  IS 'Array of amenity slugs shown on the consumer deal page. Set in vendor business settings.';