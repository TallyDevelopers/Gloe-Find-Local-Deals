CREATE TABLE IF NOT EXISTS public.redemption_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid NOT NULL REFERENCES public.vendors(id),
  attempted_by    uuid NOT NULL REFERENCES public.users(id),
  -- the code/payload the vendor entered or scanned. Stored raw for investigation.
  code_attempted  text NOT NULL,
  -- if we matched a claim, link it (NULL when the lookup found nothing).
  claim_id        uuid REFERENCES public.claims(id),
  -- 'success' = claim flipped to redeemed; 'lookup_only' = preview only (no mutation);
  -- 'refused' = wall tripped (with reason in error_code).
  outcome         text NOT NULL CHECK (outcome IN ('success', 'lookup_only', 'refused')),
  error_code      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redemption_attempts_vendor_idx
  ON public.redemption_attempts (vendor_id, created_at DESC);

COMMENT ON TABLE public.redemption_attempts IS
  'Audit log of every QR/code lookup or redemption attempt by a vendor. Read-only forensic record — never modify rows.';