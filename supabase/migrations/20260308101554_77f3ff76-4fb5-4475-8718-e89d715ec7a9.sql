-- Remove the duplicate restrictive INSERT policy that may conflict
DROP POLICY IF EXISTS "Authenticated users and valid sessions can track views" ON property_views;

-- Make the remaining INSERT policy PERMISSIVE instead of RESTRICTIVE for clarity
DROP POLICY IF EXISTS "Anyone can insert property views with valid session" ON property_views;

CREATE POLICY "Anyone can insert property views"
ON property_views FOR INSERT
TO authenticated, anon
WITH CHECK (
  (
    (auth.uid() IS NOT NULL) AND (viewer_id = auth.uid())
  )
  OR
  (
    (viewer_id IS NULL) AND (session_id IS NOT NULL) AND (length(session_id) >= 10)
  )
);