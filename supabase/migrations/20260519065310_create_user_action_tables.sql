-- ============================================================
-- SAVED_DEALS — user hearted a deal
-- ============================================================
CREATE TABLE public.saved_deals (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deal_id)
);

CREATE INDEX saved_deals_user_idx ON public.saved_deals (user_id, created_at DESC);

-- ============================================================
-- CLAIMS — user committed to a deal ("Get this deal")
-- The QR code encodes the claim id.
-- ============================================================
CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.deal_variants(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,

  -- Snapshot at claim time so future price changes don't affect existing claims.
  -- Stores: { dealTitle, vendorName, variantLabel, originalPriceCents, dealPriceCents }
  snapshot jsonb NOT NULL,

  -- QR payload — opaque server-signed token; client renders as QR
  qr_payload text NOT NULL UNIQUE,
  human_code text NOT NULL UNIQUE,  -- 8-char fallback receptionists can type

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),

  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by_provider_id uuid REFERENCES public.providers(id),

  -- Prevent the same user from claiming the same variant twice while active
  -- (enforced by partial unique index further down)
  CONSTRAINT claims_redeemed_has_timestamp
    CHECK ((status = 'redeemed') = (redeemed_at IS NOT NULL))
);

CREATE INDEX claims_user_idx ON public.claims (user_id, created_at DESC);
CREATE INDEX claims_deal_idx ON public.claims (deal_id);
CREATE INDEX claims_vendor_idx ON public.claims (vendor_id);
CREATE INDEX claims_status_idx ON public.claims (status);

-- A user can only have ONE active claim per variant at a time
CREATE UNIQUE INDEX claims_unique_active_per_variant
  ON public.claims (user_id, variant_id)
  WHERE status = 'active';

-- ============================================================
-- REVIEWS — only allowed for redeemed claims
-- ============================================================
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,

  -- Moderation
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reviews_vendor_idx ON public.reviews (vendor_id, created_at DESC);
CREATE INDEX reviews_deal_idx ON public.reviews (deal_id);
CREATE INDEX reviews_user_idx ON public.reviews (user_id);

CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: enforce that reviews can ONLY be inserted/updated
-- when the underlying claim has status = 'redeemed'
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_review_requires_redemption()
RETURNS trigger AS $$
DECLARE
  claim_status text;
BEGIN
  SELECT status INTO claim_status FROM public.claims WHERE id = NEW.claim_id;
  IF claim_status IS NULL THEN
    RAISE EXCEPTION 'Review references non-existent claim';
  END IF;
  IF claim_status <> 'redeemed' THEN
    RAISE EXCEPTION 'Reviews can only be left for redeemed claims (claim status: %)', claim_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_require_redemption
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_review_requires_redemption();

-- ============================================================
-- TRIGGER: update vendor rating aggregates when reviews change
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_vendor_rating()
RETURNS trigger AS $$
DECLARE
  target_vendor_id uuid;
BEGIN
  target_vendor_id := COALESCE(NEW.vendor_id, OLD.vendor_id);
  UPDATE public.vendors
  SET
    rating_avg = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.reviews
      WHERE vendor_id = target_vendor_id AND is_hidden = false
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE vendor_id = target_vendor_id AND is_hidden = false
    )
  WHERE id = target_vendor_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_refresh_vendor_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_vendor_rating();