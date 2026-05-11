-- Trigger function: when a new public/listed property is inserted, fire saved-search alerts via edge function
CREATE OR REPLACE FUNCTION public.trigger_saved_search_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire for newly listed, public, not-banned/frozen properties
  IF NEW.status = 'listed' AND COALESCE(NEW.is_public, true) = true 
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
$$;

DROP TRIGGER IF EXISTS on_new_property_saved_search_alerts ON public.properties;
CREATE TRIGGER on_new_property_saved_search_alerts
AFTER INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.trigger_saved_search_alerts();

-- Also fire when an existing property transitions to "listed"
CREATE OR REPLACE FUNCTION public.trigger_saved_search_alerts_on_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'listed'
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
$$;

DROP TRIGGER IF EXISTS on_property_publish_saved_search_alerts ON public.properties;
CREATE TRIGGER on_property_publish_saved_search_alerts
AFTER UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.trigger_saved_search_alerts_on_publish();