-- Cache for AI host insights to avoid regenerating on every page load
CREATE TABLE public.host_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  property_id uuid NULL,
  scope text NOT NULL CHECK (scope IN ('property','portfolio')),
  insights jsonb NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_host_ai_insights_lookup
  ON public.host_ai_insights (host_id, scope, property_id, generated_at DESC);

ALTER TABLE public.host_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view their own AI insights"
  ON public.host_ai_insights FOR SELECT
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can insert their own AI insights"
  ON public.host_ai_insights FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own AI insights"
  ON public.host_ai_insights FOR DELETE
  USING (auth.uid() = host_id);

CREATE POLICY "Admins can view all AI insights"
  ON public.host_ai_insights FOR SELECT
  USING (is_admin_or_moderator());