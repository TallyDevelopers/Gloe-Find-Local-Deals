-- ============================================================
-- PAYMENT MODEL: pay-per-transaction with Stripe Connect
-- ============================================================

-- vendors: add Stripe Connect columns; mark old subscription cols as deprecated
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS stripe_account_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_account_status text DEFAULT 'pending'
    CHECK (stripe_account_status IN ('pending', 'restricted', 'active', 'rejected', 'disabled')),
  ADD COLUMN IF NOT EXISTS payout_schedule text DEFAULT 'daily'
    CHECK (payout_schedule IN ('daily', 'weekly', 'monthly', 'manual'));

COMMENT ON COLUMN public.vendors.trial_ends_at
  IS 'DEPRECATED — Gloe pivoted from subscription to pay-per-transaction on 2026-05-19';
COMMENT ON COLUMN public.vendors.stripe_customer_id
  IS 'DEPRECATED — vendors are now Connect Accounts, not customers. See stripe_account_id.';

-- ============================================================
-- PLATFORM_FEES — admin-managed fee tiers by deal price bracket
-- ============================================================
CREATE TABLE public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  label text NOT NULL,
  min_cents int NOT NULL,
  max_cents int,

  percent_bps int NOT NULL DEFAULT 0,
  flat_cents int NOT NULL DEFAULT 0,
  min_fee_cents int NOT NULL DEFAULT 0,

  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE CASCADE,

  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (max_cents IS NULL OR max_cents > min_cents),
  CHECK (percent_bps >= 0 AND percent_bps <= 10000)
);

CREATE INDEX platform_fees_active_idx ON public.platform_fees (active, starts_at)
  WHERE active = true;
CREATE INDEX platform_fees_scope_idx ON public.platform_fees (vendor_id, category_id);

CREATE TRIGGER platform_fees_set_updated_at
  BEFORE UPDATE ON public.platform_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.claims(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,

  consumer_paid_cents int NOT NULL CHECK (consumer_paid_cents > 0),
  platform_fee_cents int NOT NULL CHECK (platform_fee_cents >= 0),
  stripe_fee_cents int NOT NULL DEFAULT 0,
  vendor_payout_cents int NOT NULL,

  platform_fee_id uuid REFERENCES public.platform_fees(id),
  platform_fee_snapshot jsonb,

  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text UNIQUE,
  stripe_transfer_id text UNIQUE,

  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'paid', 'released', 'refunded',
      'partially_refunded', 'disputed', 'failed'
    )),

  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transactions_user_idx ON public.transactions (user_id, created_at DESC);
CREATE INDEX transactions_vendor_idx ON public.transactions (vendor_id, created_at DESC);
CREATE INDEX transactions_status_idx ON public.transactions (status);

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PAYOUTS
-- ============================================================
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,

  stripe_payout_id text NOT NULL UNIQUE,
  arrival_estimate_at timestamptz,
  arrived_at timestamptz,

  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'cancelled')),
  failure_message text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payouts_vendor_idx ON public.payouts (vendor_id, created_at DESC);
CREATE INDEX payouts_status_idx ON public.payouts (status);

CREATE TABLE public.payout_transactions (
  payout_id uuid NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  PRIMARY KEY (payout_id, transaction_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_fees_vendor_read ON public.platform_fees
  FOR SELECT TO authenticated
  USING (
    vendor_id IS NULL
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = platform_fees.vendor_id AND v.owner_user_id = public.current_user_id())
  );

CREATE POLICY transactions_user_select ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

CREATE POLICY transactions_vendor_select ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = transactions.vendor_id AND v.owner_user_id = public.current_user_id())
  );

CREATE POLICY payouts_vendor_select ON public.payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = payouts.vendor_id AND v.owner_user_id = public.current_user_id())
  );

CREATE POLICY payout_tx_vendor_select ON public.payout_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payouts p
      JOIN public.vendors v ON v.id = p.vendor_id
      WHERE p.id = payout_transactions.payout_id AND v.owner_user_id = public.current_user_id()
    )
  );