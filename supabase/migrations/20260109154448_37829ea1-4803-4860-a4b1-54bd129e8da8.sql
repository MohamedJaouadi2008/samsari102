-- Create platform_settings table for configurable settings like fee rates
CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings
FOR UPDATE
USING (is_admin());

-- Only admins can insert settings
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings
FOR INSERT
WITH CHECK (is_admin());

-- Insert default platform fee rate (7%)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('platform_fee_rate', '0.07', 'Platform commission rate (e.g., 0.07 = 7%)');

-- Create function to get platform fee rate
CREATE OR REPLACE FUNCTION public.get_platform_fee_rate()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT value::numeric FROM platform_settings WHERE key = 'platform_fee_rate'),
    0.07  -- Default to 7% if not set
  );
$$;