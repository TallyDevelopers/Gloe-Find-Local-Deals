-- ============================================================
-- ROW LEVEL SECURITY
--
-- The API server uses service_role (bypasses RLS) for write paths.
-- The anon key is used for public reads from the mobile app's anonymous
-- browse experience; RLS protects user-private data from anon reads.
--
-- Helper: app.current_clerk_user_id is set per-request by the API
-- server when it acts on behalf of a signed-in user.
-- ============================================================

-- Helper function to read the current Clerk user id from the session
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.users
  WHERE clerk_user_id = current_setting('app.clerk_user_id', true)
$$;

-- ============================================================
-- USERS: a user can only see their own row
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON public.users
  FOR SELECT TO anon, authenticated
  USING (id = public.current_user_id());

-- ============================================================
-- VENDORS: publicly readable when active
-- ============================================================
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_public_select ON public.vendors
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY vendors_owner_select ON public.vendors
  FOR SELECT TO authenticated
  USING (owner_user_id = public.current_user_id());

-- ============================================================
-- PROVIDERS: public read (tied to vendors which gate themselves)
-- ============================================================
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY providers_public_select ON public.providers
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = providers.vendor_id AND v.status = 'active'
    )
  );

-- ============================================================
-- ADMIN_USERS: only the owner can see other admin rows
-- ============================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_owner_select ON public.admin_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
      WHERE a.user_id = public.current_user_id() AND a.role = 'owner'
    )
  );

-- ============================================================
-- SERVICE TAXONOMY: public read
-- ============================================================
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_subtypes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_services   ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_categories_public_select ON public.service_categories
  FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY service_subtypes_public_select ON public.service_subtypes
  FOR SELECT TO anon, authenticated USING (active = true);

CREATE POLICY vendor_services_public_select ON public.vendor_services
  FOR SELECT TO anon, authenticated USING (true);

-- ============================================================
-- DEALS: public read when active; vendor sees own at any status
-- ============================================================
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY deals_public_select ON public.deals
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY deals_vendor_owner_select ON public.deals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = deals.vendor_id AND v.owner_user_id = public.current_user_id()
    )
  );

-- ============================================================
-- DEAL_VARIANTS, DEAL_PHOTOS, DEAL_VIDEOS: visible iff parent deal is
-- ============================================================
ALTER TABLE public.deal_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_videos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_variants_inherits_select ON public.deal_variants
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_variants.deal_id AND d.status = 'active')
  );

CREATE POLICY deal_photos_inherits_select ON public.deal_photos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_photos.deal_id AND d.status = 'active')
  );

CREATE POLICY deal_videos_inherits_select ON public.deal_videos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_videos.deal_id AND d.status = 'active')
  );

-- ============================================================
-- SAVED_DEALS: user owns their saves
-- ============================================================
ALTER TABLE public.saved_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_deals_self_select ON public.saved_deals
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

CREATE POLICY saved_deals_self_insert ON public.saved_deals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY saved_deals_self_delete ON public.saved_deals
  FOR DELETE TO authenticated
  USING (user_id = public.current_user_id());

-- ============================================================
-- CLAIMS: user sees their own; vendors see claims redeemed at their shop
-- ============================================================
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY claims_self_select ON public.claims
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

CREATE POLICY claims_vendor_select ON public.claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = claims.vendor_id AND v.owner_user_id = public.current_user_id()
    )
  );

-- ============================================================
-- REVIEWS: public read (so other users see them); user manages own
-- ============================================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_public_select ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (is_hidden = false);

CREATE POLICY reviews_self_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY reviews_self_update ON public.reviews
  FOR UPDATE TO authenticated
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY reviews_self_delete ON public.reviews
  FOR DELETE TO authenticated
  USING (user_id = public.current_user_id());

-- ============================================================
-- MESSAGES + THREADS: participants only
-- ============================================================
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;

CREATE POLICY threads_participant_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_user_id()
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = message_threads.vendor_id AND v.owner_user_id = public.current_user_id()
    )
  );

CREATE POLICY messages_participant_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND (
          t.user_id = public.current_user_id()
          OR EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = t.vendor_id AND v.owner_user_id = public.current_user_id()
          )
        )
    )
  );

CREATE POLICY messages_participant_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = thread_id
        AND (
          (sender_type = 'user'   AND t.user_id = public.current_user_id() AND sender_user_id = public.current_user_id())
          OR (sender_type = 'vendor' AND EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = t.vendor_id AND v.id = sender_vendor_id AND v.owner_user_id = public.current_user_id()
          ))
        )
    )
  );