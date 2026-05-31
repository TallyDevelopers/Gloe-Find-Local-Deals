CREATE TABLE IF NOT EXISTS public.region_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  city_label  text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per email; re-signups update their latest city/coords.
CREATE UNIQUE INDEX IF NOT EXISTS region_waitlist_email_uniq
  ON public.region_waitlist (lower(email));

-- Fast "how many waiting per city" rollups.
CREATE INDEX IF NOT EXISTS region_waitlist_city_idx
  ON public.region_waitlist (city_label);

ALTER TABLE public.region_waitlist ENABLE ROW LEVEL SECURITY;
-- No public policies: only the service-role API (which bypasses RLS) writes/reads.