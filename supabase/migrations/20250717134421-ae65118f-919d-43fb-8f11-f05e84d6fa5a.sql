
-- Create admin roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert the admin user
INSERT INTO public.admin_roles (user_email, role) 
VALUES ('samsari.app@gmail.com', 'super_admin')
ON CONFLICT (user_email) DO UPDATE SET role = 'super_admin';

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE admin_roles.user_email = $1
  );
$$;

-- Create admin policy for id_verifications (admins can see all verifications)
CREATE POLICY "Admins can view all verifications" 
  ON public.id_verifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND public.is_admin(auth.users.email)
    )
  );

-- Create admin policy for profiles (admins can see all profiles)
CREATE POLICY "Admins can view all profiles" 
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND public.is_admin(auth.users.email)
    )
  );

-- Add google_maps_url column to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Enable RLS on admin_roles
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view admin roles
CREATE POLICY "Only admins can view admin roles" 
  ON public.admin_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND public.is_admin(auth.users.email)
    )
  );
