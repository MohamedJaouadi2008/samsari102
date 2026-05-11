-- Restore missing table-level grants on calendar sync tables.
-- RLS already restricts row visibility; without GRANTs, every query returns 42501.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_calendar_feeds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_calendar_feeds TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_blocked_dates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_blocked_dates TO service_role;
GRANT SELECT ON public.external_blocked_dates TO anon;