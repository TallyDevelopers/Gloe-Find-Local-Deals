-- Users can save vendors (favorite spas) alongside saved deals. Mirror of
-- saved_deals: composite PK on (user, vendor), append-only behavior driven
-- by the toggle endpoint.
CREATE TABLE IF NOT EXISTS public.saved_vendors (
  user_id    uuid NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  vendor_id  uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS saved_vendors_by_user_idx
  ON public.saved_vendors (user_id, created_at DESC);

-- Match the policy posture of saved_deals (RLS on, anon read blocked).
ALTER TABLE public.saved_vendors ENABLE ROW LEVEL SECURITY;
