-- Cache for Google Places API reviews per vendor. Refreshed on demand when
-- stale (>24h). One row per (vendor, google review id) so we can show 5 at
-- a time per Google's hard cap and keep historical reviews even if Google
-- rotates which 5 they return.

CREATE TABLE IF NOT EXISTS public.vendor_google_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  -- Google's identifier for the review author (used for upsert dedup).
  author_name     text NOT NULL,
  profile_photo_url text,
  rating          int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text            text,
  language        text,
  -- Unix epoch seconds from Google. We keep their timestamp, not our fetch time.
  authored_at     timestamptz NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_google_reviews_vendor_idx
  ON public.vendor_google_reviews (vendor_id, authored_at DESC);

-- Dedup: same author + vendor = same review. If they edit it, we overwrite.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_google_reviews_unique
  ON public.vendor_google_reviews (vendor_id, author_name, authored_at);

-- Aggregate summary, one row per vendor. Updated whenever we refresh reviews.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_review_count int,
  ADD COLUMN IF NOT EXISTS google_reviews_fetched_at timestamptz;

-- Lock down with RLS — only server (service role) writes; reads via API.
ALTER TABLE public.vendor_google_reviews ENABLE ROW LEVEL SECURITY;
