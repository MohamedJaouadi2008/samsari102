-- Add unbanned_at column to track when users are unbanned
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS unbanned_at timestamp with time zone DEFAULT NULL;