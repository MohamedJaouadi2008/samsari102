
-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert property views" ON property_views;

-- Create a PERMISSIVE INSERT policy instead
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

-- Also fix the UPDATE policies - make them PERMISSIVE
DROP POLICY IF EXISTS "Users can update their own view records" ON property_views;
CREATE POLICY "Users can update their own view records"
ON property_views FOR UPDATE
TO authenticated, anon
USING (
  ((viewer_id IS NOT NULL) AND (auth.uid() = viewer_id))
  OR
  ((viewer_id IS NULL) AND (session_id IS NOT NULL))
)
WITH CHECK (
  ((viewer_id IS NOT NULL) AND (auth.uid() = viewer_id))
  OR
  ((viewer_id IS NULL) AND (session_id IS NOT NULL))
);

DROP POLICY IF EXISTS "Anonymous can update their session views" ON property_views;
CREATE POLICY "Anonymous can update their session views"
ON property_views FOR UPDATE
TO anon
USING ((viewer_id IS NULL) AND (session_id IS NOT NULL))
WITH CHECK ((viewer_id IS NULL) AND (session_id IS NOT NULL));

-- Fix SELECT policy too
DROP POLICY IF EXISTS "Owners can view their property views" ON property_views;
CREATE POLICY "Owners can view their property views"
ON property_views FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = property_views.property_id
    AND properties.host_id = auth.uid()
  )
);
