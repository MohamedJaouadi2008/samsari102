-- Fix property_views RLS policy to allow anonymous users with valid session_ids
DROP POLICY IF EXISTS "Anyone can insert property views with valid session" ON public.property_views;

CREATE POLICY "Anyone can insert property views with valid session" 
ON public.property_views 
FOR INSERT 
WITH CHECK (
  -- Either authenticated user viewing (viewer_id matches their uid)
  (auth.uid() IS NOT NULL AND viewer_id = auth.uid())
  OR
  -- Or anonymous user with a valid session_id (no viewer_id, session_id must be at least 10 chars)
  (viewer_id IS NULL AND session_id IS NOT NULL AND length(session_id) >= 10)
);