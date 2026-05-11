-- Create property_views table for tracking page visits
CREATE TABLE public.property_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_id UUID,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  session_id TEXT,
  referrer TEXT,
  user_agent TEXT
);

-- Create index for faster queries by property_id
CREATE INDEX idx_property_views_property_id ON public.property_views(property_id);
CREATE INDEX idx_property_views_viewed_at ON public.property_views(viewed_at);

-- Enable RLS
ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

-- Policy: Property owners can view their property views
CREATE POLICY "Owners can view their property views"
  ON public.property_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_views.property_id 
      AND properties.host_id = auth.uid()
    )
  );

-- Policy: Anyone can insert views (track visits)
CREATE POLICY "Anyone can track views"
  ON public.property_views
  FOR INSERT
  WITH CHECK (true);