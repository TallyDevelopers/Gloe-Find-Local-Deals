-- ============================================================
-- GLO-44: DEAL PROMOS — "Extra $X off" placed ON a deal.
--
-- Distinct from wallet credits (GLO-24): a promo is a public discount
-- line attached to the deal itself, visible to everyone, applied
-- automatically at checkout. No wallet, no liability tail.
--
-- Funding decides the payout math (Ryan's locked spec, 2026-06-10):
--   platform : customer pays (price − promo); vendor is paid IN FULL
--              on the original price; fee computed on the original
--              price; the promo comes out of the platform fee. Mirrors
--              the credits pattern — consumer_paid_cents stays the full
--              order value, only the Stripe charge shrinks.
--   vendor   : the vendor opted in, so the sale IS at the discounted
--              price — consumer_paid_cents = discounted total, fee
--              computed on it, payout = discounted − fee(discounted).
-- ============================================================

CREATE TABLE public.deal_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  amount_cents int NOT NULL CHECK (amount_cents > 0),
  funded_by text NOT NULL CHECK (funded_by IN ('platform', 'vendor')),

  -- Optional display override ("Summer glow special"). Null = auto copy
  -- ("Extra $X off") generated from amount_cents, so badges never go
  -- stale when the amount changes.
  label text CHECK (label IS NULL OR char_length(label) <= 40),

  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,

  -- v1 ownership: admins create platform-funded, vendors create
  -- vendor-funded (their own deals only). Both are users rows; the role
  -- column records which hat they wore.
  created_by uuid REFERENCES public.users(id),
  created_by_role text NOT NULL CHECK (created_by_role IN ('admin', 'vendor')),
  ended_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (ends_at > starts_at)
);

-- One live promo per deal — no stacking promos on promos. Ending or
-- deactivating the current one frees the slot.
CREATE UNIQUE INDEX deal_promos_one_active_per_deal
  ON public.deal_promos (deal_id) WHERE active = true;

CREATE INDEX deal_promos_deal_idx ON public.deal_promos (deal_id, created_at DESC);

CREATE TRIGGER deal_promos_set_updated_at
  BEFORE UPDATE ON public.deal_promos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- All reads/writes go through the API (service role) — same posture as
-- credit_rules. Public visibility happens via deals.list, not direct reads.
ALTER TABLE public.deal_promos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRANSACTIONS — promo snapshot columns.
-- promo_discount_cents is the customer-facing discount in BOTH funding
-- modes (receipts show original / promo / credits / cash). Only the
-- PLATFORM-funded share also shrinks the cash charge below
-- consumer_paid_cents (vendor-funded already discounted consumer_paid).
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN deal_promo_id uuid REFERENCES public.deal_promos(id),
  ADD COLUMN promo_discount_cents int NOT NULL DEFAULT 0
    CHECK (promo_discount_cents >= 0),
  ADD COLUMN promo_funded_by text
    CHECK (promo_funded_by IN ('platform', 'vendor'));

-- A recorded discount must say who funded it (and vice versa).
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_promo_funded_by_chk
    CHECK ((promo_discount_cents = 0) = (promo_funded_by IS NULL));

-- Platform promo + credits can never exceed the order value.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_promo_plus_credits_lte_paid_chk
    CHECK (
      credits_applied_cents
        + CASE WHEN promo_funded_by = 'platform' THEN promo_discount_cents ELSE 0 END
      <= consumer_paid_cents
    );

-- Cash-refund ceiling drops by the platform-funded promo share (the
-- customer never paid it, so it can never come back as cash).
ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_refunded_lte_cash_chk;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_refunded_lte_cash_chk
    CHECK (
      refunded_cents <= consumer_paid_cents - credits_applied_cents
        - CASE WHEN promo_funded_by = 'platform' THEN promo_discount_cents ELSE 0 END
    );

-- Cost-to-date / analytics lookups ("orders × promo" in god mode).
CREATE INDEX transactions_deal_promo_idx ON public.transactions (deal_promo_id)
  WHERE deal_promo_id IS NOT NULL;
