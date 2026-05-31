-- Switch display_ids from random short strings to a sequential number per type,
-- starting at 300. So c_300, c_301, c_302... v_300, v_301... etc.
-- Each entity type gets its own sequence so customer 312 and vendor 312 can coexist.

CREATE SEQUENCE IF NOT EXISTS public.display_id_customer_seq START 300;
CREATE SEQUENCE IF NOT EXISTS public.display_id_vendor_seq   START 300;
CREATE SEQUENCE IF NOT EXISTS public.display_id_txn_seq      START 300;
CREATE SEQUENCE IF NOT EXISTS public.display_id_claim_seq    START 300;

-- New generator: prefix + sequence value. We don't pad — 300, 301, ... 9999 just look like numbers.
CREATE OR REPLACE FUNCTION public.gen_display_id(prefix text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  seq_name text;
  next_val bigint;
BEGIN
  seq_name := CASE prefix
    WHEN 'c' THEN 'public.display_id_customer_seq'
    WHEN 'v' THEN 'public.display_id_vendor_seq'
    WHEN 't' THEN 'public.display_id_txn_seq'
    WHEN 'r' THEN 'public.display_id_claim_seq'
    ELSE NULL
  END;
  IF seq_name IS NULL THEN
    RAISE EXCEPTION 'Unknown display_id prefix: %', prefix;
  END IF;
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  RETURN prefix || '_' || next_val::text;
END;
$$;

-- Re-roll existing rows in deterministic order (oldest = lowest number).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS n
  FROM public.users
)
UPDATE public.users u SET display_id = 'c_' || (300 + ordered.n)::text
FROM ordered WHERE ordered.id = u.id;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS n
  FROM public.vendors
)
UPDATE public.vendors v SET display_id = 'v_' || (300 + ordered.n)::text
FROM ordered WHERE ordered.id = v.id;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS n
  FROM public.transactions
)
UPDATE public.transactions t SET display_id = 't_' || (300 + ordered.n)::text
FROM ordered WHERE ordered.id = t.id;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS n
  FROM public.claims
)
UPDATE public.claims c SET display_id = 'r_' || (300 + ordered.n)::text
FROM ordered WHERE ordered.id = c.id;

-- Advance each sequence past whatever's already in the table so new inserts
-- pick up where backfill left off.
SELECT setval('public.display_id_customer_seq', 300 + (SELECT COUNT(*) FROM public.users),        false);
SELECT setval('public.display_id_vendor_seq',   300 + (SELECT COUNT(*) FROM public.vendors),      false);
SELECT setval('public.display_id_txn_seq',      300 + (SELECT COUNT(*) FROM public.transactions), false);
SELECT setval('public.display_id_claim_seq',    300 + (SELECT COUNT(*) FROM public.claims),       false);
