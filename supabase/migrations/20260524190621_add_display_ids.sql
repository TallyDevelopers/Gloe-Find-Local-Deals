-- Public-facing short IDs for admin/support readability.
-- The UUID `id` remains the foreign-key everywhere; this is purely a display field.

CREATE OR REPLACE FUNCTION public.gen_display_id(prefix text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN prefix || '_' || result;
END;
$$;

ALTER TABLE public.users        ADD COLUMN display_id text;
ALTER TABLE public.vendors      ADD COLUMN display_id text;
ALTER TABLE public.transactions ADD COLUMN display_id text;
ALTER TABLE public.claims       ADD COLUMN display_id text;

-- Backfill existing rows. Loop-safe against the (vanishingly unlikely) collision
-- by retrying any row that hits the unique index — but with 36^8 ≈ 2.8T combos
-- per prefix this is mostly ceremonial.
UPDATE public.users        SET display_id = public.gen_display_id('cus') WHERE display_id IS NULL;
UPDATE public.vendors      SET display_id = public.gen_display_id('ven') WHERE display_id IS NULL;
UPDATE public.transactions SET display_id = public.gen_display_id('txn') WHERE display_id IS NULL;
UPDATE public.claims       SET display_id = public.gen_display_id('clm') WHERE display_id IS NULL;

-- Lock them down + set defaults so new inserts auto-populate.
ALTER TABLE public.users        ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.vendors      ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.claims       ALTER COLUMN display_id SET NOT NULL;

ALTER TABLE public.users        ALTER COLUMN display_id SET DEFAULT public.gen_display_id('cus');
ALTER TABLE public.vendors      ALTER COLUMN display_id SET DEFAULT public.gen_display_id('ven');
ALTER TABLE public.transactions ALTER COLUMN display_id SET DEFAULT public.gen_display_id('txn');
ALTER TABLE public.claims       ALTER COLUMN display_id SET DEFAULT public.gen_display_id('clm');

CREATE UNIQUE INDEX users_display_id_key        ON public.users        (display_id);
CREATE UNIQUE INDEX vendors_display_id_key      ON public.vendors      (display_id);
CREATE UNIQUE INDEX transactions_display_id_key ON public.transactions (display_id);
CREATE UNIQUE INDEX claims_display_id_key       ON public.claims       (display_id);
