-- ============================================================
-- MESSAGE_THREADS — a DM thread between a user and a vendor
-- ============================================================
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,

  -- Cached for thread list rendering
  last_message_at timestamptz,
  last_message_preview text,
  user_unread_count int NOT NULL DEFAULT 0,
  vendor_unread_count int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- One thread per (user, vendor) pair
  UNIQUE (user_id, vendor_id)
);

CREATE INDEX message_threads_user_idx ON public.message_threads (user_id, last_message_at DESC);
CREATE INDEX message_threads_vendor_idx ON public.message_threads (vendor_id, last_message_at DESC);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,

  -- sender_type identifies which side wrote it; sender_id refs the correct table
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'vendor')),
  sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sender_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,

  body text NOT NULL,
  read_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT messages_sender_matches_type CHECK (
    (sender_type = 'user'   AND sender_user_id   IS NOT NULL AND sender_vendor_id IS NULL) OR
    (sender_type = 'vendor' AND sender_vendor_id IS NOT NULL AND sender_user_id   IS NULL)
  )
);

CREATE INDEX messages_thread_idx ON public.messages (thread_id, created_at DESC);

-- Update thread cache on new message
CREATE OR REPLACE FUNCTION public.refresh_thread_on_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.message_threads
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 120),
    user_unread_count = CASE
      WHEN NEW.sender_type = 'vendor' THEN user_unread_count + 1
      ELSE user_unread_count
    END,
    vendor_unread_count = CASE
      WHEN NEW.sender_type = 'user' THEN vendor_unread_count + 1
      ELSE vendor_unread_count
    END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_refresh_thread
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.refresh_thread_on_message();