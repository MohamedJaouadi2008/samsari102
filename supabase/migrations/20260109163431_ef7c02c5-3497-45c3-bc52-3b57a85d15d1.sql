-- Create ban_appeals table
CREATE TABLE public.ban_appeals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  appeal_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ban_appeals ENABLE ROW LEVEL SECURITY;

-- Users can create their own appeals
CREATE POLICY "Users can create their own appeals"
ON public.ban_appeals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own appeals
CREATE POLICY "Users can view their own appeals"
ON public.ban_appeals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all appeals
CREATE POLICY "Admins can view all appeals"
ON public.ban_appeals
FOR SELECT
TO authenticated
USING (is_admin());

-- Admins can update appeals
CREATE POLICY "Admins can update appeals"
ON public.ban_appeals
FOR UPDATE
TO authenticated
USING (is_admin());

-- Create index for faster queries
CREATE INDEX idx_ban_appeals_user_id ON public.ban_appeals(user_id);
CREATE INDEX idx_ban_appeals_status ON public.ban_appeals(status);