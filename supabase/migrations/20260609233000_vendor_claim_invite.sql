-- GLO-5: vendor claim & invite flow.
-- Admin pre-creates a vendor (owner_user_id null) with the owner's email;
-- "Invite owner" fires a Clerk invitation and stamps when it went out. The
-- owner's signed-in session later claims the vendor by verified-email match.

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS owner_invited_at timestamptz;
