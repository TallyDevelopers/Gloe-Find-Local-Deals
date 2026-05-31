ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_source text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS payer_email text,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_source_check
  CHECK (payment_source IN ('in_app', 'gift_link'));

CREATE INDEX IF NOT EXISTS transactions_stripe_checkout_session_id_idx
  ON public.transactions(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON COLUMN public.transactions.payment_source IS
  'How the purchase was initiated: in_app (Stripe PaymentSheet inside the mobile app) or gift_link (Stripe-hosted Checkout Session opened via shared URL).';
COMMENT ON COLUMN public.transactions.payer_email IS
  'For gift_link transactions: email of the actual cardholder, captured by Stripe Checkout. NULL for in_app (use users.email via user_id).';
COMMENT ON COLUMN public.transactions.payer_name IS
  'For gift_link transactions: cardholder name from Stripe Checkout. NULL for in_app.';
COMMENT ON COLUMN public.transactions.stripe_checkout_session_id IS
  'For gift_link transactions: the Checkout Session ID. NULL for in_app (use stripe_payment_intent_id).';