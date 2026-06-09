-- ============================================================
-- REINSTATE RESTORES DEALS (follow-on to vendor suspend kill switch)
-- ============================================================
-- Suspending a vendor pulls every active/paused/pending_review deal to draft.
-- Before this column, reinstating left them ALL drafted — the admin had to
-- re-publish by hand. pre_suspend_status remembers what each deal was at
-- suspension time so unsuspend can put every deal back exactly as it was.
-- NULL = deal was not touched by a suspension (or has been restored).

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS pre_suspend_status text;
