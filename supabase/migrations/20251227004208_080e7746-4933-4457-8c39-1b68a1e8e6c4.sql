-- Add columns for visit duration tracking
ALTER TABLE public.property_views 
ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_bounce boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS exit_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS referrer_type text DEFAULT NULL;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_property_views_analytics 
ON public.property_views (property_id, viewed_at, duration_seconds);

-- Update RLS policy to allow updating own view records
CREATE POLICY "Users can update their own view records" 
ON public.property_views 
FOR UPDATE 
USING (
  (viewer_id IS NOT NULL AND auth.uid() = viewer_id) OR 
  (session_id = current_setting('request.headers', true)::json->>'x-session-id')
);

-- Allow anonymous users to update by session_id (for tracking exit)
CREATE POLICY "Anonymous can update their session views" 
ON public.property_views 
FOR UPDATE 
USING (viewer_id IS NULL AND session_id IS NOT NULL)
WITH CHECK (viewer_id IS NULL AND session_id IS NOT NULL);