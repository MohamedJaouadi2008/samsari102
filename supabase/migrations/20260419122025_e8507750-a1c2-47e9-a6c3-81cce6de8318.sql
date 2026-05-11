
-- Drop existing view to allow column reorder
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- ============================================================
-- 1. Helper function: does user have an active paid booking?
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_active_booking_for_property(_user_id uuid, _property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE property_id = _property_id
      AND guest_id = _user_id
      AND status IN ('deposit_paid','payment_authorized','payment_held','awaiting_checkin','checked_in','checked_out','settlement_pending','dispute_window','settled')
  );
$$;

-- ============================================================
-- 2. PROFILES
-- ============================================================
DROP POLICY IF EXISTS "Anonymous can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Public can view safe profile columns" ON public.profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id, username, full_name, avatar_url, bio,
  is_host, is_superhost, superhost_since,
  verification_status, created_at
FROM public.profiles
WHERE COALESCE(is_banned, false) = false;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
ALTER VIEW public.public_profiles SET (security_invoker = true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, username, full_name, avatar_url, bio,
  is_host, is_superhost, superhost_since,
  verification_status, created_at, updated_at
) ON public.profiles TO anon, authenticated;

CREATE POLICY "Public can view safe profile columns"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================
-- 3. PROPERTIES
-- ============================================================
REVOKE SELECT ON public.properties FROM anon, authenticated;

GRANT SELECT (
  id, host_id, title, description, property_type,
  governorate, city, photos, amenities,
  bedrooms, bathrooms, max_guests, extra_beds, bed_types, sleeping_arrangements,
  price_per_night, currency, minimum_stay,
  cancellation_policy, house_rules, visitor_policy, safety_features,
  check_in_time, check_out_time,
  status, is_public, booking_enabled, is_banned, is_frozen,
  short_code, welcome_message,
  coordinates, address, google_maps_url, parking_info,
  created_at, updated_at
) ON public.properties TO anon, authenticated;

GRANT SELECT (wifi_name, wifi_password, lockbox_code, arrival_instructions)
  ON public.properties TO authenticated;

CREATE OR REPLACE FUNCTION public.get_property_access_info(_property_id uuid)
RETURNS TABLE (
  wifi_name text,
  wifi_password text,
  lockbox_code text,
  arrival_instructions text,
  parking_info text,
  address text,
  google_maps_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = _property_id
      AND (
        p.host_id = auth.uid()
        OR public.is_admin_or_moderator()
        OR public.has_active_booking_for_property(auth.uid(), _property_id)
      )
  ) THEN
    RETURN QUERY
      SELECT p.wifi_name, p.wifi_password, p.lockbox_code,
             p.arrival_instructions, p.parking_info, p.address, p.google_maps_url
      FROM public.properties p
      WHERE p.id = _property_id;
  ELSE
    RAISE EXCEPTION 'Not authorized to view property access info';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_property_access_info(uuid) TO authenticated;

-- ============================================================
-- 4. PLATFORM_SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

CREATE POLICY "Authenticated users can read platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- 5. ESCROW_AUDIT_LOG
-- ============================================================
DROP POLICY IF EXISTS "Only system can insert audit logs" ON public.escrow_audit_log;

CREATE POLICY "Admins can insert audit logs"
ON public.escrow_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- ============================================================
-- 6. STORAGE: property-photos
-- ============================================================
DROP POLICY IF EXISTS "Property photos are publicly viewable" ON storage.objects;
CREATE POLICY "Property photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "Hosts can upload to own property folder" ON storage.objects;
CREATE POLICY "Hosts can upload to own property folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Hosts can delete own property photos" ON storage.objects;
CREATE POLICY "Hosts can delete own property photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin_or_moderator()
  )
);

DROP POLICY IF EXISTS "Hosts can update own property photos" ON storage.objects;
CREATE POLICY "Hosts can update own property photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
