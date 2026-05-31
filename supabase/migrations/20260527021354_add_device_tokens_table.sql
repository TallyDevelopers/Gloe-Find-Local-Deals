
-- Device tokens for APNs (iOS push notifications). One row per device per user.
-- Tokens are device-specific and can change on app reinstall, OS upgrade, or
-- iCloud restore — the mobile app re-registers on every launch via upsert.
--
-- We trigger sends from server-side events (e.g. someone redeems a gift link
-- the user generated → notify the user that their friend booked their gift).

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  -- The opaque token APNs/FCM hands us. We treat it as the unique key per
  -- platform; if it shows up again for a different user, we move it (devices
  -- are user-scoped, but the same physical device can be used by multiple
  -- users if they sign in/out).
  token           TEXT NOT NULL,
  -- Track when we last successfully sent / saw it so we can prune dead tokens.
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_unique
  ON public.device_tokens (token);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx
  ON public.device_tokens (user_id);

COMMENT ON TABLE public.device_tokens IS
  'APNs/FCM device tokens, one per user-device pair. Refreshed on each app launch.';
