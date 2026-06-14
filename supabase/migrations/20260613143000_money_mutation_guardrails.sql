-- Money/inventory safety guardrails from GLO-58.
-- NOT VALID avoids blocking deploy if historic data already drifted, while
-- still enforcing the rule for new writes.

ALTER TABLE public.deal_variants
  ADD CONSTRAINT deal_variants_spots_claimed_lte_total_chk
  CHECK (spots_total IS NULL OR spots_claimed <= spots_total) NOT VALID;
