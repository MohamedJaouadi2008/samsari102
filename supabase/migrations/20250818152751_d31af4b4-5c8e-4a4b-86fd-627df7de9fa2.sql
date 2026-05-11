
-- Fix the is_admin function to have an immutable search_path
CREATE OR REPLACE FUNCTION public.is_admin(user_email text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE admin_roles.user_email = $1
  );
$function$
