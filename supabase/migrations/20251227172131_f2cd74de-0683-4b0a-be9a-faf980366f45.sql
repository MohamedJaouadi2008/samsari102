-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'support');

-- Create user_roles table following security best practices
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'moderator', 'support')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add property status fields
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS is_frozen boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS frozen_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS frozen_reason text,
ADD COLUMN IF NOT EXISTS banned_reason text;

-- Add user ban and warning fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_reason text,
ADD COLUMN IF NOT EXISTS warning_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_warning_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_warning_reason text;

-- Add allow_resubmit column to id_verifications
ALTER TABLE public.id_verifications
ADD COLUMN IF NOT EXISTS allow_resubmit boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS warning_count integer DEFAULT 0;

-- Migrate existing admin_roles to new user_roles table
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT ar.user_id, 'admin'::app_role, ar.created_at
FROM public.admin_roles ar
WHERE ar.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;