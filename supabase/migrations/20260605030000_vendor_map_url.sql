-- Cached static-map snapshot for a vendor, captured when their address is set
-- (signup / admin onboarding). Lets the vendor profile and any deal fall back to
-- a real map instead of "Map unavailable", with no per-view Google cost.
ALTER TABLE public.vendors ADD COLUMN map_url text;
