-- Restore missing table-level privileges on properties and bookings.
-- RLS already restricts row visibility; without GRANTs, every query 42501s.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings   TO authenticated;
GRANT SELECT ON public.properties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings   TO service_role;

-- Saved-search alert triggers still test for status='listed'; canonical value is 'published'.
CREATE OR REPLACE FUNCTION public.trigger_saved_search_alerts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'published' AND COALESCE(NEW.is_public, true) = true 
     AND COALESCE(NEW.is_banned, false) = false 
     AND COALESCE(NEW.is_frozen, false) = false THEN
    PERFORM net.http_post(
      url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/process-saved-search-alerts',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('property_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_saved_search_alerts_on_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'published'
     AND COALESCE(NEW.is_public, true) = true
     AND COALESCE(NEW.is_banned, false) = false
     AND COALESCE(NEW.is_frozen, false) = false THEN
    PERFORM net.http_post(
      url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/process-saved-search-alerts',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('property_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;