
-- Trigger function that fires BEFORE DELETE on properties
-- Sends the photo URLs to the cleanup edge function via pg_net
CREATE OR REPLACE FUNCTION public.cleanup_property_photos_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only call cleanup if there are photos to delete
  IF OLD.photos IS NOT NULL AND jsonb_array_length(OLD.photos) > 0 THEN
    PERFORM net.http_post(
      url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/cleanup-property-photos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
      ),
      body := jsonb_build_object(
        'property_id', OLD.id,
        'photos', OLD.photos
      )
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create the trigger (AFTER DELETE so it doesn't block the delete)
DROP TRIGGER IF EXISTS trigger_cleanup_property_photos ON properties;
CREATE TRIGGER trigger_cleanup_property_photos
  AFTER DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_property_photos_on_delete();
