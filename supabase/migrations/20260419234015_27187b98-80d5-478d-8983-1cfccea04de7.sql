CREATE TABLE IF NOT EXISTS public.admin_picks_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_date date NOT NULL UNIQUE,
  property_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  count integer,
  note text,
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_picks_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view picks overrides"
  ON public.admin_picks_override FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert picks overrides"
  ON public.admin_picks_override FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_moderator());

CREATE POLICY "Admins can update picks overrides"
  ON public.admin_picks_override FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_moderator())
  WITH CHECK (public.is_admin_or_moderator());

CREATE POLICY "Admins can delete picks overrides"
  ON public.admin_picks_override FOR DELETE
  TO authenticated
  USING (public.is_admin_or_moderator());

CREATE TRIGGER update_admin_picks_override_updated_at
  BEFORE UPDATE ON public.admin_picks_override
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_admin_picks_override_date ON public.admin_picks_override(pick_date);