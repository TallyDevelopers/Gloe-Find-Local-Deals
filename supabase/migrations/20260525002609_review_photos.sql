-- Customers can attach up to 3 photos to a review. Same shape as deal_photos
-- but with display_order so we keep the upload sequence intact.
CREATE TABLE IF NOT EXISTS public.review_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id     uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url           text NOT NULL,
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_photos_by_review_idx
  ON public.review_photos (review_id, display_order);

-- RLS: locked down by default (matches the posture of other tables); the
-- API uses the service role.
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;
