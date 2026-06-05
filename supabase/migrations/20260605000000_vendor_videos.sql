-- Vendor-level videos for the storefront "Inside the spa" reel.
--
-- Previously the profile pulled videos from deal_videos (listing-level), which
-- meant the reel changed/disappeared as deals came and went and couldn't be
-- curated independently of an active listing. Videos are now a property of the
-- VENDOR: uploaded by the vendor (self-service) or by an admin at onboarding,
-- and they persist regardless of deal lifecycle. Deal-level videos still exist
-- and still render on individual listing pages — unaffected.
CREATE TABLE public.vendor_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text NOT NULL,
  caption text,
  duration_seconds int,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_videos_vendor ON public.vendor_videos (vendor_id, display_order, created_at DESC);
