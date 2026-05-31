ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS auto_release_on_redemption boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vendors.auto_release_on_redemption IS
  'When true, redemption immediately triggers a Stripe Transfer to this vendor''s connected account. When false, the transfer is queued until an admin (or, later, a scheduled job after the hold window) pushes it. See CREDITS_AND_FEES.md §6b.';