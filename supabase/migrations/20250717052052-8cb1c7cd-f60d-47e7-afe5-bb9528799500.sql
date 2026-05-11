
-- Add columns to profiles table for profile pictures and verification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMP WITH TIME ZONE;

-- Create ID verification table
CREATE TABLE IF NOT EXISTS public.id_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cin_front_url TEXT NOT NULL,
  cin_back_url TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewer_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on id_verifications
ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;

-- Policies for id_verifications (users can only see their own)
CREATE POLICY "Users can view their own verification" 
  ON public.id_verifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verification" 
  ON public.id_verifications FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create properties table for hosted listings
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  coordinates JSONB,
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  max_guests INTEGER NOT NULL DEFAULT 4,
  bed_types JSONB DEFAULT '[]',
  extra_beds INTEGER DEFAULT 0,
  visitor_policy TEXT DEFAULT 'morning_only' CHECK (visitor_policy IN ('morning_only', 'overnight_allowed', 'no_visitors')),
  amenities JSONB DEFAULT '[]',
  photos JSONB DEFAULT '[]',
  price_per_night DECIMAL(10,2) NOT NULL,
  is_public BOOLEAN DEFAULT true,
  booking_enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Policies for properties
CREATE POLICY "Anyone can view public properties" 
  ON public.properties FOR SELECT 
  USING (is_public = true AND status = 'published');

CREATE POLICY "Hosts can manage their own properties" 
  ON public.properties FOR ALL 
  USING (auth.uid() = host_id);

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policies for bookings
CREATE POLICY "Users can view their own bookings" 
  ON public.bookings FOR SELECT 
  USING (auth.uid() = guest_id OR auth.uid() = host_id);

CREATE POLICY "Users can create bookings" 
  ON public.bookings FOR INSERT 
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Hosts can update their property bookings" 
  ON public.bookings FOR UPDATE 
  USING (auth.uid() = host_id);

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for ID verification documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('id-verification', 'id-verification', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for property photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for ID verification bucket (only users can upload their own)
CREATE POLICY "Users can upload their own ID documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'id-verification' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for property photos
CREATE POLICY "Anyone can view property photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-photos');

CREATE POLICY "Authenticated users can upload property photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-photos' AND 
    auth.role() = 'authenticated'
  );
