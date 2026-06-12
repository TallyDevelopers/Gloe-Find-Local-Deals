-- GLO-35: record the vendor's acceptance of the Gloē Vendor Agreement.
-- Stamped by vendor.signup when the required checkbox is ticked. Nullable:
-- pre-existing vendors and admin-pre-created (unclaimed) profiles have not
-- accepted yet — they get stamped on their next explicit acceptance moment.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text;

COMMENT ON COLUMN public.vendors.terms_accepted_at IS
  'When the owner accepted the Vendor Agreement (/legal/vendor-terms).';
COMMENT ON COLUMN public.vendors.terms_version IS
  'Version (date string) of the Vendor Agreement that was accepted.';
