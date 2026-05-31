-- Support tickets: consumer ↔ Gloē. Distinct from the (dead, vendor-shaped)
-- message_threads tables. UUID keys (gen_display_id('s') is unregistered and throws).
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject         text NOT NULL,
  category        text CHECK (category IN ('refund','voucher','payment','account','vendor','other')),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','awaiting_us','awaiting_customer','resolved','closed')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON public.support_tickets(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type    text NOT NULL CHECK (sender_type IN ('customer','agent','system')),
  sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  body           text NOT NULL,
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON public.support_messages(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON public.support_messages(ticket_id) WHERE read_at IS NULL;

-- RLS: owner-read, mirroring saved_deals. The API connects as a privileged role
-- and bypasses these; they exist so the anon/authenticated Supabase key can never
-- read another user's support PII.
ALTER TABLE public.support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_self_select ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = current_user_id());
CREATE POLICY support_tickets_self_insert ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = current_user_id());

CREATE POLICY support_messages_self_select ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t
            WHERE t.id = support_messages.ticket_id AND t.user_id = current_user_id())
  );
CREATE POLICY support_messages_self_insert ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.support_tickets t
            WHERE t.id = support_messages.ticket_id AND t.user_id = current_user_id())
  );