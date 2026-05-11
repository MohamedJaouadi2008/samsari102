
-- Idempotency table for Stripe webhooks
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view processed events"
  ON public.processed_stripe_events FOR SELECT
  TO authenticated
  USING (public.is_admin_or_moderator());

-- No INSERT/UPDATE/DELETE policies => only service role can write

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON public.processed_stripe_events (processed_at DESC);

-- Rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  scope text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limits"
  ON public.rate_limits FOR SELECT
  TO authenticated
  USING (public.is_admin_or_moderator());

-- No INSERT/UPDATE/DELETE policies => only service role can write

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_identifier_scope_window
  ON public.rate_limits (identifier, scope, window_start);

CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at
  ON public.rate_limits (created_at DESC);

-- Helper function: atomic check-and-increment for rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _scope text,
  _max_requests integer,
  _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  -- Round window down to bucket boundary
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / _window_seconds) * _window_seconds
  );

  INSERT INTO public.rate_limits (identifier, scope, window_start, request_count)
  VALUES (_identifier, _scope, v_window_start, 1)
  ON CONFLICT (identifier, scope, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Periodic cleanup: delete rows older than 1 day
  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '1 day'
    AND random() < 0.01; -- 1% sampling to avoid hot-path overhead

  RETURN v_count <= _max_requests;
END;
$$;
