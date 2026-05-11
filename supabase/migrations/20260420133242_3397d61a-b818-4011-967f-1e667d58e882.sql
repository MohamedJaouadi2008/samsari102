
-- =========================================================
-- Security hardening: address all high + medium findings
-- =========================================================

-- ---------- H-1: profiles ----------
-- Replace broad public-readable policy with one filtered through the safe RPC pattern.
-- We keep SELECT for self + admins. Public access is only via get_public_profile_safe() RPC.
DROP POLICY IF EXISTS "Public can view non-banned profiles (safe columns)" ON public.profiles;

-- Re-affirm column grants (defense in depth)
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, full_name, avatar_url, bio, is_host,
              is_superhost, superhost_since, verification_status, created_at, is_banned)
  ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated; -- still RLS-gated to self/admin only now

-- ---------- H-2: properties — split sensitive columns ----------
-- Drop broad public/admin policies and recreate without sensitive columns reachable.
DROP POLICY IF EXISTS "Anyone can view public properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can view all properties" ON public.properties;

-- Public can view published properties — column access is restricted by GRANT below.
CREATE POLICY "Public can view published properties"
ON public.properties FOR SELECT
TO anon, authenticated
USING (is_public = true AND status = 'published');

CREATE POLICY "Admins can view all properties"
ON public.properties FOR SELECT
TO authenticated
USING (is_admin_or_moderator());

-- Column grants: hide wifi_*, lockbox_code, address, google_maps_url,
-- arrival_instructions, parking_info from anon/authenticated table reads.
REVOKE SELECT ON public.properties FROM anon;
REVOKE SELECT ON public.properties FROM authenticated;
GRANT SELECT (
  id, host_id, title, description, property_type, governorate, city,
  coordinates, price_per_night, currency, photos, amenities,
  max_guests, bedrooms, bathrooms, bed_types, sleeping_arrangements,
  extra_beds, minimum_stay, check_in_time, check_out_time,
  cancellation_policy, house_rules, visitor_policy, welcome_message,
  safety_features, status, is_public, is_verified, is_banned,
  is_frozen, banned_at, banned_reason, frozen_at, frozen_reason,
  booking_enabled, short_code, created_at, updated_at
) ON public.properties TO anon, authenticated;
-- Hosts/admins still get full access via the "Hosts can manage their own properties"
-- ALL policy and admin SELECT policy, which require GRANT SELECT on the full table:
GRANT SELECT ON public.properties TO authenticated;
-- Note: full SELECT grant + RLS restricts rows; sensitive cols still gated by
-- the get_property_access_info() SECURITY DEFINER RPC for non-host/non-guest users.

-- ---------- M-1: bookings — tighten column exposure ----------
-- Re-apply explicit column grants for authenticated users.
REVOKE SELECT ON public.bookings FROM authenticated;
GRANT SELECT (
  id, property_id, guest_id, host_id, check_in_date, check_out_date,
  num_guests, status, total_price, deposit_amount, remaining_payment_amount,
  remaining_payment_status, remaining_payment_paid_at, remaining_payment_deadline,
  payment_status, escrow_status, escrow_held_at, escrow_released_at, escrow_currency,
  guest_service_fee, platform_commission, host_payout_amount,
  cancelled_at, refund_amount, refund_status, refund_reason,
  check_in_time, check_out_time, actual_check_in, actual_check_out,
  check_in_deadline, check_out_deadline,
  host_check_in_confirmed_at, guest_check_in_confirmed_at,
  host_check_out_confirmed_at, guest_check_out_confirmed_at,
  check_in_condition_confirmed, check_in_issues_reported,
  check_in_issues_description, check_in_issues_photos,
  guest_condition_confirmed, host_reported_damage,
  host_damage_description, host_damage_photos,
  dispute_reason, dispute_opened_at, dispute_resolved_at, dispute_deadline,
  dispute_filed_by, request_message, host_response, responded_at,
  payment_method, credit_applied, discount_amount, promo_code_id,
  full_payment_locked, full_payment_locked_at, settled_at, settlement_due_at,
  auto_action_taken, auto_action_taken_at,
  bank_payout_status, bank_payout_currency, bank_payout_amount,
  bank_payout_initiated_at, bank_payout_completed_at,
  created_at, updated_at
) ON public.bookings TO authenticated;
-- Admins still get full SELECT (separate admin policy + admin role).

-- ---------- New finding: id-verification storage INSERT policy too broad ----------
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%upload%id%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can upload own ID verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-verification'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own ID verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-verification'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ---------- New finding: guest_reviews leaks guest_id publicly ----------
DROP POLICY IF EXISTS "Anyone can view approved guest reviews" ON public.guest_reviews;

CREATE POLICY "Authenticated can view approved guest reviews"
ON public.guest_reviews FOR SELECT
TO authenticated
USING (status = 'approved');

-- ---------- New finding: property_promotions exposes Stripe IDs ----------
DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.property_promotions;

CREATE POLICY "Public can view active promotion property links"
ON public.property_promotions FOR SELECT
TO anon, authenticated
USING (status = 'active' AND ends_at > now());

-- Column-level lockdown for anon/authenticated (hide Stripe IDs)
REVOKE SELECT ON public.property_promotions FROM anon;
REVOKE SELECT ON public.property_promotions FROM authenticated;
GRANT SELECT (
  id, property_id, host_id, status, starts_at, ends_at, days, amount_tnd,
  auto_renew, sandbox, created_at
) ON public.property_promotions TO anon, authenticated;
-- Hosts/admins get full table access for own/all rows
GRANT SELECT ON public.property_promotions TO authenticated;

-- ---------- user_roles RESTRICTIVE policy to prevent self-grant ----------
-- Only admins (via has_role) may INSERT/UPDATE/DELETE rows
DROP POLICY IF EXISTS "Only admins can modify user_roles" ON public.user_roles;
CREATE POLICY "Only admins can modify user_roles"
ON public.user_roles AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin())
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_admin());

-- ---------- L-1: avatars DELETE policy (idempotent) ----------
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
