-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send email on notification insert
CREATE OR REPLACE FUNCTION public.trigger_notification_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  supabase_url TEXT;
  anon_key TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  
  -- Get user name from profiles
  SELECT full_name INTO user_name FROM public.profiles WHERE id = NEW.user_id;
  
  -- Only send if we have an email
  IF user_email IS NOT NULL THEN
    -- Call edge function via pg_net
    PERFORM net.http_post(
      url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/send-notification-email',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', NEW.type,
        'recipientEmail', user_email,
        'recipientName', COALESCE(user_name, 'there'),
        'title', NEW.title,
        'message', NEW.message,
        'link', NEW.link,
        'bookingId', NEW.booking_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notification_email();

-- Create function to send welcome email on profile creation
CREATE OR REPLACE FUNCTION public.trigger_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Only send if we have an email
  IF user_email IS NOT NULL THEN
    -- Call edge function for welcome email
    PERFORM net.http_post(
      url := 'https://gigzciepwjrwbljdnixh.supabase.co/functions/v1/send-notification-email',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', 'welcome',
        'recipientEmail', user_email,
        'recipientName', COALESCE(NEW.full_name, 'there')
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on profiles table for welcome email
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_email();