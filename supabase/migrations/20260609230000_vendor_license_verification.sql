-- GLO-19: provider license verification flow.
-- Vendors submit license number + state + type + a document (photo/PDF);
-- admin reviews and approves/rejects. Approval is what takes a vendor from
-- pending_approval to active (the "vetted & licensed" gate).

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS license_type text,
  ADD COLUMN IF NOT EXISTS license_document_path text,
  ADD COLUMN IF NOT EXISTS license_status text NOT NULL DEFAULT 'unverified'
    CHECK (license_status IN ('unverified', 'pending_review', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS license_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_rejection_reason text;

-- Grandfather anyone already verified the legacy way (license + verified_at
-- both set by an admin). Existing live-but-unlicensed vendors keep selling
-- (status untouched) and surface as 'unverified' in god-mode for follow-up.
UPDATE public.vendors
SET license_status = 'verified'
WHERE license_number IS NOT NULL AND verified_at IS NOT NULL;

-- Private bucket for license documents. Never public: reads happen through
-- short-lived signed URLs generated for admins; uploads through signed
-- upload URLs scoped to the vendor's own folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('license-docs', 'license-docs', false)
ON CONFLICT (id) DO NOTHING;
