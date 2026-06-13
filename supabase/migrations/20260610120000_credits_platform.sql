-- ============================================================
-- GLO-24: WALLET CREDITS PLATFORM
--
-- Single dollar wallet per user, lot-based append-only ledger.
-- Credits are PLATFORM-funded: vendor payout math never changes;
-- credits only reduce the customer's cash charge. Every knob is a
-- credit_rules row (the platform_fees pattern) so god mode can edit
-- amounts without a deploy. See docs/specs/glo-24-credits-spec.md.
-- ============================================================

-- ============================================================
-- CREDIT_RULES — admin-managed earn rules (mirror platform_fees:
-- soft-delete via active flag, never DELETE).
--   purchase_tier : earn credit_cents OR percent_bps on a purchase
--                   whose total falls in [min_purchase, max_purchase)
--   referral      : give_cents → referee (at attribution, locked until
--                   a first purchase ≥ min_first_purchase_cents);
--                   get_cents → referrer (when that purchase fulfills)
--   signup_bonus  : credit_cents on first signup
-- ============================================================
CREATE TABLE public.credit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_type text NOT NULL CHECK (rule_type IN ('purchase_tier', 'referral', 'signup_bonus')),

  -- purchase_tier bracket [min, max). max NULL = open-ended.
  min_purchase_cents int,
  max_purchase_cents int,

  -- Reward: flat cents XOR percent of order (purchase_tier / signup_bonus).
  credit_cents int,
  percent_bps int,

  -- Referral amounts: give_cents = referee's credit, get_cents = referrer's.
  give_cents int,
  get_cents int,
  -- Referee's lot only redeems on a first purchase ≥ this (pre-credit total).
  min_first_purchase_cents int,

  expires_after_days int NOT NULL DEFAULT 90,

  -- Abuse caps. monthly_user_cap_cents applies to referral+signup earns only;
  -- monthly_referral_payout_cap = max referrer payouts per user per month.
  monthly_user_cap_cents int,
  monthly_referral_payout_cap int,

  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (max_purchase_cents IS NULL OR max_purchase_cents > min_purchase_cents),
  CHECK (percent_bps IS NULL OR (percent_bps > 0 AND percent_bps <= 10000)),
  -- A purchase_tier reward is cents XOR bps (one or the other, never both).
  CHECK (
    rule_type <> 'purchase_tier'
    OR ((credit_cents IS NOT NULL)::int + (percent_bps IS NOT NULL)::int = 1)
  ),
  CHECK (rule_type <> 'referral' OR (give_cents > 0 AND get_cents > 0)),
  CHECK (expires_after_days > 0)
);

CREATE INDEX credit_rules_active_idx ON public.credit_rules (rule_type, starts_at)
  WHERE active = true;

CREATE TRIGGER credit_rules_set_updated_at
  BEFORE UPDATE ON public.credit_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CREDIT_CAMPAIGNS — push-credit blasts ("$10 to everyone lapsed").
-- Draft → sent; granted_count/granted_cents track send progress.
-- ============================================================
CREATE TABLE public.credit_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  expires_after_days int NOT NULL DEFAULT 90 CHECK (expires_after_days > 0),
  audience text NOT NULL
    CHECK (audience IN ('everyone', 'lapsed_60d', 'signed_up_never_purchased')),

  message_title text NOT NULL,
  message_body text NOT NULL,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  created_by uuid REFERENCES public.users(id),
  sent_at timestamptz,
  granted_count int NOT NULL DEFAULT 0,
  granted_cents int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CREDIT_LOTS — every credit GRANT is a lot. remaining_cents is the
-- ONLY mutable column (drawdown). Clawback may push it negative,
-- netting against future earns. Balance = SUM(remaining_cents).
-- ============================================================
CREATE TABLE public.credit_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- referral_give = referee's lot (funded by give_cents, granted at
  -- attribution); referral_get = referrer's lot (funded by get_cents,
  -- granted when the referee's first qualifying purchase fulfills).
  kind text NOT NULL CHECK (kind IN (
    'referral_give', 'referral_get', 'purchase_reward', 'signup_bonus',
    'promo', 'admin_grant', 'refund_return'
  )),

  amount_cents int NOT NULL CHECK (amount_cents > 0),
  remaining_cents int NOT NULL,
  expires_at timestamptz,

  rule_id uuid REFERENCES public.credit_rules(id),
  campaign_id uuid REFERENCES public.credit_campaigns(id),
  -- The EARNING transaction (purchase_reward / referral_get / refund_return).
  transaction_id uuid REFERENCES public.transactions(id),
  -- For referral lots: the referee's user id — both sides of a referral pair
  -- carry the same referral_id, which is also the idempotency key.
  referral_id uuid REFERENCES public.users(id),
  note text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_lots_user_idx ON public.credit_lots (user_id, created_at DESC);
-- Daily expiry sweep scans only live, expiring remainders.
CREATE INDEX credit_lots_expiring_idx ON public.credit_lots (expires_at)
  WHERE remaining_cents > 0 AND expires_at IS NOT NULL;

-- Idempotency walls: webhook retries / double-clicks must not double-grant.
CREATE UNIQUE INDEX credit_lots_kind_txn_uniq
  ON public.credit_lots (kind, transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX credit_lots_kind_referral_uniq
  ON public.credit_lots (kind, referral_id) WHERE referral_id IS NOT NULL;
CREATE UNIQUE INDEX credit_lots_campaign_user_uniq
  ON public.credit_lots (campaign_id, user_id) WHERE campaign_id IS NOT NULL;

-- ============================================================
-- CREDIT_ENTRIES — append-only debits against lots. Never UPDATE/DELETE.
-- ============================================================
CREATE TABLE public.credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  kind text NOT NULL CHECK (kind IN ('redemption', 'expiry', 'clawback', 'forfeiture')),
  amount_cents int NOT NULL CHECK (amount_cents < 0),

  -- redemption: the purchase that spent the credit. clawback: the refunded/
  -- disputed transaction that triggered the unwind.
  transaction_id uuid REFERENCES public.transactions(id),
  lot_id uuid NOT NULL REFERENCES public.credit_lots(id),

  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_entries_user_idx ON public.credit_entries (user_id, created_at DESC);
CREATE INDEX credit_entries_lot_idx ON public.credit_entries (lot_id);
CREATE INDEX credit_entries_txn_idx ON public.credit_entries (transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ============================================================
-- DELETED_ACCOUNT_EMAIL_HASHES — referral/signup-bonus abuse guard.
-- On account deletion we store sha256(lower(email) + CREDITS_EMAIL_HASH_SALT);
-- a matching hash at attribution means the "new" user isn't genuinely new.
-- ============================================================
CREATE TABLE public.deleted_account_email_hashes (
  email_hash text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS — referral identity + dispute freeze
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN referral_code text UNIQUE,
  ADD COLUMN referred_by uuid REFERENCES public.users(id),
  -- Set while a dispute is open; redemption refuses while frozen.
  ADD COLUMN credit_frozen_at timestamptz;

-- ============================================================
-- TRANSACTIONS — split-tender columns.
-- consumer_paid_cents KEEPS its meaning (full order value); credits only
-- reduce the cash charged to Stripe. refunded_cents stays CASH-only, so its
-- ceiling drops from the full order value to the cash share.
-- ============================================================
ALTER TABLE public.transactions
  ADD COLUMN credits_applied_cents int NOT NULL DEFAULT 0
    CHECK (credits_applied_cents >= 0),
  ADD COLUMN credits_refunded_cents int NOT NULL DEFAULT 0
    CHECK (credits_refunded_cents >= 0),
  -- charge.payment_method_details.card.fingerprint from the webhook's expanded
  -- PaymentIntent — the referral self-funding guard compares these.
  ADD COLUMN card_fingerprint text;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_credits_lte_paid_chk
    CHECK (credits_applied_cents <= consumer_paid_cents),
  ADD CONSTRAINT transactions_credits_refunded_lte_applied_chk
    CHECK (credits_refunded_cents <= credits_applied_cents);

ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_refunded_lte_paid_chk;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_refunded_lte_cash_chk
    CHECK (refunded_cents <= consumer_paid_cents - credits_applied_cents);

-- Fingerprint history lookups ("has this referrer ever paid with this card?").
CREATE INDEX transactions_card_fingerprint_idx ON public.transactions (card_fingerprint)
  WHERE card_fingerprint IS NOT NULL;

-- ============================================================
-- RLS — users read their own ledger; ALL writes go through the API
-- (service role). Rules / campaigns / email hashes are admin-only:
-- RLS enabled with no policies = no anon/authenticated access.
-- ============================================================
ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_account_email_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_lots_self_select ON public.credit_lots
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

CREATE POLICY credit_entries_self_select ON public.credit_entries
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

-- ============================================================
-- SEED RULES — launch posture (GLO-24):
--   referral $20/$20, $50 referee first-order floor  → ACTIVE
--   purchase tiers $100–250→$10, $250–500→$20, $500+→$25 → built, INACTIVE
--   signup bonus $10 → built, INACTIVE
-- ============================================================
INSERT INTO public.credit_rules
  (rule_type, give_cents, get_cents, min_first_purchase_cents,
   expires_after_days, monthly_user_cap_cents, monthly_referral_payout_cap, active)
VALUES
  ('referral', 2000, 2000, 5000, 90, 10000, 10, true);

INSERT INTO public.credit_rules
  (rule_type, min_purchase_cents, max_purchase_cents, credit_cents, expires_after_days, active)
VALUES
  ('purchase_tier', 10000, 25000, 1000, 90, false),
  ('purchase_tier', 25000, 50000, 2000, 90, false),
  ('purchase_tier', 50000, NULL,  2500, 90, false);

INSERT INTO public.credit_rules
  (rule_type, credit_cents, expires_after_days, monthly_user_cap_cents, active)
VALUES
  ('signup_bonus', 1000, 90, 10000, false);

-- ============================================================
-- SEED NOTIFICATION TYPES — all sends go through the registry.
-- credit_granted renders caller-supplied copy ({{title}}/{{body}}, the
-- support_reply pattern) so campaigns keep their authored message.
-- credit_expiry_reminder is delayed 60m so the queue's dedup_key
-- enforces once-per-lot-per-window (immediate sends skip dedup).
-- ============================================================
INSERT INTO public.notification_types
  (key, label, description, enabled, delay_minutes, title_template, body_template, thread_id)
VALUES
  ('credit_granted', 'Credit granted',
   'Tells a customer Gloē credit landed in their wallet (admin grant, campaign, or refund return).',
   true, 0,
   '{{title}}',
   '{{body}}',
   'credits'),
  ('referral_attributed', 'Referral attributed',
   'Tells a referrer their code was used — credit pays out after the friend''s first booking.',
   true, 0,
   'Your invite worked 🎉',
   '{{refereeName}} joined with your code. You''ll get {{amount}} after their first booking.',
   'credits'),
  ('referral_complete', 'Referral complete',
   'Tells a referrer their friend''s first booking went through and their credit is in the wallet.',
   true, 0,
   'You earned {{amount}}',
   '{{refereeName}} booked their first treatment — {{amount}} in credit is in your wallet.',
   'credits'),
  ('credit_expiry_reminder', 'Credit expiry reminder',
   'Nudges a customer 7 days and 1 day before unspent credit expires.',
   true, 60,
   'Your Gloē credit expires soon',
   '{{amount}} in credit expires {{when}}. Use it before it''s gone.',
   'credits')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- BACKFILL referral codes for existing users (6 chars, A-Z2-9, no
-- vowels/0/1/I/O — same alphabet as domain/referrals.ts).
-- ============================================================
DO $$
DECLARE
  u record;
  candidate text;
  alphabet constant text := 'BCDFGHJKLMNPQRSTVWXYZ23456789';
BEGIN
  FOR u IN SELECT id FROM public.users WHERE referral_code IS NULL LOOP
    LOOP
      candidate := '';
      FOR i IN 1..6 LOOP
        candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      BEGIN
        UPDATE public.users SET referral_code = candidate WHERE id = u.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- collision (1 in 29^6) — roll again
      END;
    END LOOP;
  END LOOP;
END $$;
