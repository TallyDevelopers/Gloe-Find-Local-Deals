-- ============================================================
-- INITIAL FEE TIERS (placeholder values — Ryan will tune from admin)
-- All tiers are global (vendor_id + category_id = NULL).
-- percent_bps: basis points (800 = 8.00%)
-- ============================================================

INSERT INTO public.platform_fees (label, min_cents, max_cents, percent_bps, flat_cents, min_fee_cents, active)
VALUES
  ('Under $100',  0,      10000,  800,  0, 400, true),   -- 8% with $4 minimum
  ('$100–$249',   10000,  25000,  900,  0, 0,   true),   -- 9%
  ('$250–$499',   25000,  50000,  1100, 0, 0,   true),   -- 11%
  ('$500+',       50000,  NULL,   1300, 0, 0,   true);   -- 13%