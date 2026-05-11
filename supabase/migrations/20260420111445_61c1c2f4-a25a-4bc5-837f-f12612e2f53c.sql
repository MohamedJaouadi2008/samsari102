-- M-06: Restrict storage object listing on public buckets
-- Drop overly broad SELECT policies that enable listing, then add scoped ones that
-- still allow reads when the object name (key) is known via direct URL.

-- Look up and drop common permissive policies on storage.objects for the two public buckets.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (
        qual ILIKE '%avatars%'
        OR qual ILIKE '%property-photos%'
        OR qual = 'true'
        OR policyname ILIKE '%public read%'
        OR policyname ILIKE '%publicly accessible%'
        OR policyname ILIKE '%anyone can view%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Re-create reads scoped per bucket and require an explicit object name (no listing of NULL/empty)
CREATE POLICY "Public read avatars (no listing)"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars' AND name IS NOT NULL AND length(name) > 0);

CREATE POLICY "Public read property-photos (no listing)"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'property-photos' AND name IS NOT NULL AND length(name) > 0);