-- Notification registry: one place to control every push the app sends.
--
-- Before this, push types were scattered — two fired unconditionally from code
-- (gift_booked, support_reply), one had a hand-rolled flag in platform_settings
-- (review_prompt). This replaces that mess with a single table where each push
-- type is a row: enabled on/off, an optional delay, and editable copy. Every
-- send-site now goes through one gate (sendNotification) that reads this table.
--
-- Delayed types (delay_minutes > 0) don't send inline — they enqueue into
-- notification_queue, which an in-API cron drains once due. Immediate types
-- (delay_minutes = 0) send straight away through the same gate.

-- ── Registry ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_types (
  -- Stable identifier referenced from code, e.g. 'review_prompt'. Never rename;
  -- code looks types up by this key.
  key             TEXT PRIMARY KEY,
  -- Human label + description shown in the admin Notifications panel.
  label           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  enabled         BOOLEAN NOT NULL DEFAULT false,
  -- 0 = send immediately. >0 = enqueue and send this many minutes after the
  -- triggering event (e.g. review_prompt fires hours after redemption).
  delay_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  -- Copy templates. Support {{var}} placeholders filled in at send time
  -- (e.g. body 'Leave a review for {{vendorName}} ✨').
  title_template  TEXT NOT NULL,
  body_template   TEXT NOT NULL,
  -- iOS thread-id for visual grouping; mirrors the old hardcoded threadId.
  thread_id       TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_types IS
  'Registry of every push type. One row per type; the admin panel renders these and every send-site checks enabled/delay here.';

-- ── Delayed-send queue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key        TEXT NOT NULL REFERENCES public.notification_types(key) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- The {{var}} values to render the templates with, captured at enqueue time
  -- so copy is correct even if the triggering record changes later.
  vars            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Optional structured payload for the push (deep-link data, e.g. claimId).
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Idempotency / re-trigger guard: a stable key for the originating event
  -- (e.g. 'review_prompt:<claimId>'). Prevents enqueueing the same prompt twice.
  dedup_key       TEXT,
  send_after      TIMESTAMPTZ NOT NULL,
  -- Stamped once the cron has processed the row. NULL = still pending.
  sent_at         TIMESTAMPTZ,
  -- If the cron decided NOT to send (guard failed, e.g. already reviewed),
  -- it stamps this with the reason instead of sent_at.
  skipped_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_queue IS
  'Pending delayed pushes. An in-API cron drains rows where send_after <= now() and sent_at IS NULL.';

-- Cron scan: pending + due. Partial index keeps it tiny (only unsent rows).
CREATE INDEX IF NOT EXISTS notification_queue_due_idx
  ON public.notification_queue (send_after)
  WHERE sent_at IS NULL AND skipped_reason IS NULL;

-- Enforce idempotency where a dedup_key is provided.
CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_dedup_idx
  ON public.notification_queue (dedup_key)
  WHERE dedup_key IS NOT NULL;

-- ── Seed the three push types that already exist in code ────────────────────
-- gift_booked + support_reply fire immediately (delay 0); they were previously
-- unconditional — we seed them ENABLED to preserve today's behaviour.
-- review_prompt carries forward the old platform_settings flag and defaults to
-- a 3-hour delay (the calm, DoorDash-style timing the user wants).
-- (Apple Wallet pass-update pushes aren't built yet — when they are, add a row.)
INSERT INTO public.notification_types
  (key, label, description, enabled, delay_minutes, title_template, body_template, thread_id)
VALUES
  ('gift_booked', 'Gift booked',
   'Tells the gifter their friend redeemed the gift link and booked.',
   true, 0,
   '{{payerName}} booked your gift 🎁',
   'Their voucher is on the way. Tap to view the booking.',
   'gift-bookings'),
  ('support_reply', 'Support reply',
   'Notifies a customer when an admin replies to their support ticket.',
   true, 0,
   'Gloē Support',
   '{{body}}',
   'support-tickets'),
  ('review_prompt', 'Review prompt',
   'Asks the customer to leave a review some hours after their visit (voucher redeemed).',
   COALESCE((SELECT value = 'true' FROM public.platform_settings WHERE key = 'review_prompt_push_enabled' LIMIT 1), false),
   180,
   'How was your visit?',
   'Leave a review for {{vendorName}} ✨',
   'reviews')
ON CONFLICT (key) DO NOTHING;
