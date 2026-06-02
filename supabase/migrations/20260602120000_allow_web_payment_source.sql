-- Web self-purchase via Stripe-hosted Checkout introduces a third payment
-- source alongside 'in_app' (native PaymentSheet) and 'gift_link' (share-to-pay).
-- Extend the CHECK constraint to allow 'web'. Additive + backward compatible.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_payment_source_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_payment_source_check
  CHECK (payment_source IN ('in_app', 'gift_link', 'web'));
