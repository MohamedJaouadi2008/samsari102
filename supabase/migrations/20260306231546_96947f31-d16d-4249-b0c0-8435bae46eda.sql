
-- 1. Fix review RLS policy to match new booking statuses
DROP POLICY IF EXISTS "Users can create reviews for their completed bookings" ON public.reviews;
CREATE POLICY "Users can create reviews for their completed bookings"
ON public.reviews FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) AND 
  (EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = reviews.booking_id 
      AND b.guest_id = auth.uid()
      AND b.status IN ('checked_out', 'settlement_pending', 'dispute_window', 'settled')
      AND b.actual_check_out IS NOT NULL
  ))
);

-- 2. Create guest_reviews table (host reviews guest)
CREATE TABLE public.guest_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  guest_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id, host_id)
);

ALTER TABLE public.guest_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can create guest reviews for their bookings"
ON public.guest_reviews FOR INSERT
WITH CHECK (
  auth.uid() = host_id AND
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = guest_reviews.booking_id
      AND b.host_id = auth.uid()
      AND b.status IN ('checked_out', 'settlement_pending', 'dispute_window', 'settled')
      AND b.actual_check_out IS NOT NULL
  )
);

CREATE POLICY "Anyone can view approved guest reviews"
ON public.guest_reviews FOR SELECT
USING (status = 'approved');

CREATE POLICY "Hosts can view their own guest reviews"
ON public.guest_reviews FOR SELECT
USING (auth.uid() = host_id);

CREATE POLICY "Admins can view all guest reviews"
ON public.guest_reviews FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update guest reviews"
ON public.guest_reviews FOR UPDATE
USING (is_admin());

-- 3. Create user_reports table
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
ON public.user_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id AND auth.uid() != reported_user_id);

CREATE POLICY "Users can view their own reports"
ON public.user_reports FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
ON public.user_reports FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update reports"
ON public.user_reports FOR UPDATE
USING (is_admin());

-- 4. Create user_blocks table
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can block others"
ON public.user_blocks FOR INSERT
WITH CHECK (auth.uid() = blocker_id AND auth.uid() != blocked_user_id);

CREATE POLICY "Users can view their own blocks"
ON public.user_blocks FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
ON public.user_blocks FOR DELETE
USING (auth.uid() = blocker_id);

-- 5. Update public_profiles view to include full_name and bio
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.bio,
  p.is_host,
  p.verification_status,
  p.created_at
FROM profiles p;
