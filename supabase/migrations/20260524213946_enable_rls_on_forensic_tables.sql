-- Lock down the two tables that hold money + scan forensics. The anon and
-- authenticated client roles should never touch these directly — the API
-- (which uses service_role via the connection string) is the only legitimate
-- reader and writer.
--
-- Why this matters: audit_log is the money trail (refunds, transfers, wind-downs)
-- and redemption_attempts is the scan forensic record. Both are subpoena-grade
-- evidence. With RLS off, anyone with the anon key could forge or wipe rows.

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_attempts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS entirely, so we don't need a policy to grant it
-- access. But we explicitly LACK any policies for anon/authenticated, which
-- means with RLS enabled, those roles get nothing. That's the goal.
--
-- If we ever need to surface these to vendors or customers via the API, the
-- API already does the read with the service role and returns whatever shape
-- it wants. No client-side direct access needed.
