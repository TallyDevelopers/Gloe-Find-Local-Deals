ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
-- Partial index so auth lookups can cheaply skip soft-deleted accounts.
CREATE INDEX IF NOT EXISTS users_active_idx ON public.users (clerk_user_id) WHERE deleted_at IS NULL;