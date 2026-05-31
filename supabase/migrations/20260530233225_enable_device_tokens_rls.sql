-- Pre-existing hole: device_tokens had RLS disabled, exposing users' APNs tokens
-- to the anon/authenticated Supabase key. The API uses a privileged role and
-- bypasses RLS, so this only tightens the public surface.
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY device_tokens_self_select ON public.device_tokens
  FOR SELECT TO authenticated USING (user_id = current_user_id());
CREATE POLICY device_tokens_self_insert ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = current_user_id());
CREATE POLICY device_tokens_self_delete ON public.device_tokens
  FOR DELETE TO authenticated USING (user_id = current_user_id());