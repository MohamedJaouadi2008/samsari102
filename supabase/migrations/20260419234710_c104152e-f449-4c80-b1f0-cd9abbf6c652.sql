ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_is_verified ON public.properties(is_verified) WHERE is_verified = true;