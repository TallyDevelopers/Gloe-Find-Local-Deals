-- Shorten display IDs to single-letter prefix + 4-char base36 random.
-- ~1.7M combos per prefix is plenty for Gloe's lifetime.
-- c_ = customer, v_ = vendor, t_ = transaction, r_ = redemption/claim.

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
  FOR i IN 1..4 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN prefix || '_' || result;
END;
$$;

-- Re-roll all existing display_ids with the new format + prefix scheme.
-- Defaults still reference the 3-letter prefixes; switch them too.
UPDATE public.users        SET display_id = public.gen_display_id('c');
UPDATE public.vendors      SET display_id = public.gen_display_id('v');
UPDATE public.transactions SET display_id = public.gen_display_id('t');
UPDATE public.claims       SET display_id = public.gen_display_id('r');

ALTER TABLE public.users        ALTER COLUMN display_id SET DEFAULT public.gen_display_id('c');
ALTER TABLE public.vendors      ALTER COLUMN display_id SET DEFAULT public.gen_display_id('v');
ALTER TABLE public.transactions ALTER COLUMN display_id SET DEFAULT public.gen_display_id('t');
ALTER TABLE public.claims       ALTER COLUMN display_id SET DEFAULT public.gen_display_id('r');
