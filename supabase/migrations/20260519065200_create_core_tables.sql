-- ============================================================
-- USERS — mirrors Clerk users into our DB
-- We don't store passwords; Clerk owns auth. We just store the
-- shape of a user so we can FK to it from saved_deals, claims, etc.
-- ============================================================
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email text,
  phone text,
  first_name text,
  last_name text,
  image_url text,

  -- last known location (for "near me" queries)
  selected_city text,
  selected_location extensions.geography(POINT, 4326),

  -- monthly redemption tracking (5/month cap by default)
  monthly_redemption_limit int NOT NULL DEFAULT 5,
  monthly_redemptions_used int NOT NULL DEFAULT 0,
  monthly_reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_clerk_user_id_idx ON public.users (clerk_user_id);
CREATE INDEX users_selected_location_idx ON public.users USING GIST (selected_location);

-- ============================================================
-- VENDORS — businesses that post deals
-- ============================================================
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,

  business_name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,

  -- Contact
  email text,
  phone text,
  website text,
  instagram_handle text,

  -- Location
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  region text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  location extensions.geography(POINT, 4326) NOT NULL,

  -- Branding
  logo_url text,
  hero_image_url text,

  -- Operating
  hours_summary text,  -- human-readable, e.g. "Mon-Sat · 9am-7pm"

  -- License / verification
  license_number text,
  license_state text,
  verified_at timestamptz,

  -- Subscription / status
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'active', 'paused', 'suspended', 'rejected')),
  trial_ends_at timestamptz,
  stripe_customer_id text,

  -- Cached aggregates (updated by triggers / cron)
  rating_avg numeric(3,2),
  review_count int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendors_location_idx ON public.vendors USING GIST (location);
CREATE INDEX vendors_city_idx ON public.vendors (city);
CREATE INDEX vendors_status_idx ON public.vendors (status);
CREATE INDEX vendors_slug_idx ON public.vendors (slug);

-- ============================================================
-- PROVIDERS — the actual practitioners at a vendor
-- A vendor (Glow La Jolla) has 1..N providers (Madison NP, etc.)
-- ============================================================
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,

  name text NOT NULL,
  title text NOT NULL CHECK (title IN ('MD', 'DO', 'NP', 'PA', 'RN', 'LE', 'Other')),
  bio text,
  photo_url text,
  license_number text,
  display_order int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX providers_vendor_id_idx ON public.providers (vendor_id);

-- ============================================================
-- ADMIN_USERS — Gloe staff (Ryan + future moderators)
-- A user becomes an admin by having a row here.
-- ============================================================
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'moderator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Helper: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER vendors_set_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();