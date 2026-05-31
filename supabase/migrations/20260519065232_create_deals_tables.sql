-- ============================================================
-- SERVICE TAXONOMY — admin-editable, NOT hardcoded
-- ============================================================
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  icon text,
  is_unit_based boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.service_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  unit_label text,  -- 'units', 'syringes', 'sessions', 'mg', etc.
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (category_id, slug)
);

-- A vendor declares which categories they serve (filters posting options)
CREATE TABLE public.vendor_services (
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (vendor_id, category_id)
);

-- ============================================================
-- DEALS — vendor postings
-- ============================================================
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id),
  subtype_id uuid REFERENCES public.service_subtypes(id),

  title text NOT NULL,
  description text NOT NULL,
  whats_included jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of strings

  -- Lifecycle
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'expired', 'sold_out', 'rejected')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,

  -- Per-customer + code rules
  per_customer_limit int NOT NULL DEFAULT 1,
  code_validity_days int NOT NULL DEFAULT 7,

  -- Restrictions + fine print
  restrictions jsonb NOT NULL DEFAULT '[]'::jsonb,
  fine_print text,

  -- Sponsorship (the visual chip + ranking boost)
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsored_until timestamptz,

  -- Moderation
  approved_by uuid REFERENCES public.admin_users(id),
  approved_at timestamptz,
  rejection_reason text,

  -- Cached counts
  view_count int NOT NULL DEFAULT 0,
  save_count int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deals_vendor_id_idx ON public.deals (vendor_id);
CREATE INDEX deals_category_id_idx ON public.deals (category_id);
CREATE INDEX deals_status_idx ON public.deals (status);
CREATE INDEX deals_expires_at_idx ON public.deals (expires_at);
CREATE INDEX deals_is_sponsored_idx ON public.deals (is_sponsored) WHERE is_sponsored = true;

CREATE TRIGGER deals_set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- DEAL_VARIANTS — size/quantity options for a deal
-- e.g. "Botox" deal has 20u / 40u / 60u variants
-- ============================================================
CREATE TABLE public.deal_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  label text NOT NULL,         -- "20 units" / "1 syringe" / "3-session series"
  unit_count int,
  unit_label text,             -- denormalized from subtype for display
  display_order int NOT NULL DEFAULT 0,

  original_price_cents int NOT NULL CHECK (original_price_cents > 0),
  deal_price_cents int NOT NULL CHECK (deal_price_cents > 0),

  -- Optional cap on total redemptions
  spots_total int,
  spots_claimed int NOT NULL DEFAULT 0,

  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deal_variants_deal_id_idx ON public.deal_variants (deal_id);

-- ============================================================
-- DEAL_PHOTOS — gallery + hero + before/after
-- ============================================================
CREATE TABLE public.deal_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  url text NOT NULL,
  photo_type text NOT NULL DEFAULT 'gallery'
    CHECK (photo_type IN ('hero', 'gallery', 'before_after')),
  display_order int NOT NULL DEFAULT 0,
  consent_attested boolean NOT NULL DEFAULT false,  -- required true for before_after
  caption text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deal_photos_deal_id_idx ON public.deal_photos (deal_id);

-- ============================================================
-- DEAL_VIDEOS — "Inside [vendor]" content
-- Vendor-uploaded promotional / educational videos.
-- ============================================================
CREATE TABLE public.deal_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,

  video_url text NOT NULL,
  thumbnail_url text NOT NULL,
  caption text,
  duration_seconds int,
  display_order int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deal_videos_deal_id_idx ON public.deal_videos (deal_id);