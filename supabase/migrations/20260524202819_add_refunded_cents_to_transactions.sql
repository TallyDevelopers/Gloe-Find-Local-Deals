-- Track the cumulative refunded amount per transaction so we can support
-- partial refunds (status = partially_refunded) and prevent over-refunding.
-- `refunded_at` already exists but only captures the first/last refund moment;
-- this is the authoritative ledger column.

ALTER TABLE public.transactions
  ADD COLUMN refunded_cents int NOT NULL DEFAULT 0
  CHECK (refunded_cents >= 0);

-- Sanity: refunded_cents should never exceed what the customer actually paid.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_refunded_lte_paid_chk
  CHECK (refunded_cents <= consumer_paid_cents);
