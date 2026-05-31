ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS instant_payout_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendors.instant_payout_enabled IS
  'Vendor has opted in to instant payouts (3% fee per CREDITS_AND_FEES.md §1b). Requires a debit card on file via their Stripe Express dashboard.';