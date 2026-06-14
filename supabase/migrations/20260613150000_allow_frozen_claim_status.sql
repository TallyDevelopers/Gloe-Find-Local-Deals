-- GLO-34: dispute webhooks freeze active claims while a payment dispute is open.
-- The application already uses claims.status = 'frozen'; keep the database
-- constraint aligned so charge.dispute.created cannot fail at the freeze wall.

ALTER TABLE public.claims
  DROP CONSTRAINT IF EXISTS claims_status_check;

ALTER TABLE public.claims
  ADD CONSTRAINT claims_status_check
  CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled', 'frozen'));
