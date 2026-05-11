-- iCal calendar feeds (per property, per provider)
CREATE TABLE public.property_calendar_feeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL,
  host_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'other', -- airbnb | booking | vrbo | other
  feed_name text,
  feed_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_sync_status text, -- success | error
  last_sync_error text,
  events_imported integer DEFAULT 0,
  export_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_feeds_property ON public.property_calendar_feeds(property_id);
CREATE INDEX idx_calendar_feeds_host ON public.property_calendar_feeds(host_id);

ALTER TABLE public.property_calendar_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own feeds"
ON public.property_calendar_feeds
FOR ALL
TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Admins view all feeds"
ON public.property_calendar_feeds
FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

CREATE TRIGGER update_calendar_feeds_updated_at
BEFORE UPDATE ON public.property_calendar_feeds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- External blocked dates imported from feeds
CREATE TABLE public.external_blocked_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL,
  feed_id uuid NOT NULL REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  summary text,
  external_uid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_id, external_uid)
);

CREATE INDEX idx_external_blocked_property ON public.external_blocked_dates(property_id);
CREATE INDEX idx_external_blocked_dates ON public.external_blocked_dates(start_date, end_date);

ALTER TABLE public.external_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Anyone can read external blocked dates (so booking calendars can show them as unavailable)
CREATE POLICY "Public read external blocked dates"
ON public.external_blocked_dates
FOR SELECT
TO public
USING (true);

-- Hosts can delete their own (via cascade or manually)
CREATE POLICY "Hosts can delete own feed dates"
ON public.external_blocked_dates
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.property_calendar_feeds f
  WHERE f.id = external_blocked_dates.feed_id AND f.host_id = auth.uid()
));

-- Edge functions using SERVICE_ROLE bypass RLS for inserts/updates.