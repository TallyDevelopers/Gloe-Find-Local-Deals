CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'transfer.created' | 'transfer.refused' | 'instant_payout.requested' | 'instant_payout.refused'
  -- 'fee_tier.created' | 'fee_tier.updated' | 'fee_tier.deactivated' | 'fee_tier.reactivated'
  -- 'vendor.suspended' | 'vendor.reinstated'
  -- 'vendor.auto_release.set' | 'vendor.instant_payout.set'
  -- (redemption attempts live in their own table — this is the cross-cutting log)
  action        text NOT NULL,
  -- Who initiated. NULL for system-driven (webhooks, cron).
  actor_user_id uuid REFERENCES public.users(id),
  -- What entity the action targeted, if applicable.
  vendor_id     uuid REFERENCES public.vendors(id),
  claim_id      uuid REFERENCES public.claims(id),
  transaction_id uuid REFERENCES public.transactions(id),
  payout_id     uuid REFERENCES public.payouts(id),
  -- Free-form details (amount, before/after values, error reason, Stripe ids).
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_vendor_idx ON public.audit_log (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx  ON public.audit_log (actor_user_id, created_at DESC);

COMMENT ON TABLE public.audit_log IS
  'Append-only audit trail for money-moving + admin actions. Never UPDATE or DELETE rows. Per-feature logs (redemption_attempts, payouts, transactions) remain authoritative for those domains; this is the cross-cutting forensic record.';