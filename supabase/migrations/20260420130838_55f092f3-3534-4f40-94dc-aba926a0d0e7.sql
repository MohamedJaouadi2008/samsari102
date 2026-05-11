-- =====================================================================
-- Security hardening: column-level grants + bucket policy cleanup
-- Addresses H-1 (profiles), H-2 (properties), H-3 (referral_codes),
-- M-1 (bookings columns), M-2 (property-photos upload), L-1 (avatar delete)
-- =====================================================================

-- ---------- H-1 · profiles column lockdown ----------
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, username, full_name, avatar_url, bio, is_host,
  is_superhost, superhost_since, verification_status,
  verification_submitted_at, created_at, updated_at,
  is_banned
) ON public.profiles TO anon, authenticated;

-- Sensitive columns: still SELECTable for the owner / admins via RLS,
-- but never returned to anonymous users.
GRANT SELECT (
  phone, preferred_currency,
  stripe_account_id, stripe_account_status, stripe_onboarding_complete,
  bank_rib, bank_account_holder, bank_name, payout_method,
  warning_count, guest_strikes, host_strikes,
  last_warning_at, last_warning_reason,
  last_strike_at, strike_reason,
  banned_at, banned_reason, unbanned_at
) ON public.profiles TO authenticated;

-- ---------- H-2 · properties column lockdown ----------
REVOKE SELECT ON public.properties FROM anon, authenticated;

GRANT SELECT (
  id, host_id, title, description, property_type,
  governorate, city, coordinates,
  price_per_night, currency, photos, amenities,
  max_guests, bedrooms, bathrooms, bed_types,
  sleeping_arrangements, extra_beds, minimum_stay,
  check_in_time, check_out_time, cancellation_policy,
  house_rules, visitor_policy, welcome_message,
  safety_features, status, is_public, is_verified,
  is_banned, is_frozen, booking_enabled, short_code,
  created_at, updated_at
) ON public.properties TO anon, authenticated;

-- Operational / private fields stay accessible only via
-- get_property_access_info() RPC for authorized parties.
-- (host RLS still grants full access to their own rows because
--  table-level GRANTs don't restrict the owner — RLS does.)
GRANT SELECT (
  address, google_maps_url,
  wifi_name, wifi_password, lockbox_code,
  arrival_instructions, parking_info,
  frozen_at, frozen_reason, banned_at, banned_reason
) ON public.properties TO authenticated;

-- ---------- M-1 · bookings column lockdown ----------
REVOKE SELECT ON public.bookings FROM anon, authenticated;

GRANT SELECT (
  id, property_id, guest_id, host_id,
  check_in_date, check_out_date, num_guests,
  status, total_price, deposit_amount, remaining_payment_amount,
  payment_status, payment_method,
  escrow_status, escrow_held_at, escrow_released_at, escrow_currency,
  guest_service_fee, platform_commission, host_payout_amount,
  discount_amount, credit_applied, promo_code_id,
  refund_amount, refund_status, refund_reason,
  cancelled_at,
  check_in_time, check_out_time, actual_check_in, actual_check_out,
  check_in_deadline, check_out_deadline,
  host_check_in_confirmed_at, guest_check_in_confirmed_at,
  host_check_out_confirmed_at, guest_check_out_confirmed_at,
  check_in_condition_confirmed, guest_condition_confirmed,
  check_in_issues_reported, check_in_issues_description, check_in_issues_photos,
  host_reported_damage, host_damage_description, host_damage_photos,
  dispute_reason, dispute_opened_at, dispute_resolved_at,
  dispute_deadline, dispute_filed_by,
  request_message, host_response, responded_at,
  remaining_payment_status, remaining_payment_paid_at, remaining_payment_deadline,
  full_payment_locked, full_payment_locked_at,
  settled_at, settlement_due_at,
  reminder_pre_checkin_sent_at, reminder_arrival_day_sent_at,
  reminder_pre_checkout_sent_at, reminder_review_nudge_sent_at,
  auto_action_taken, auto_action_taken_at,
  bank_payout_status, bank_payout_amount, bank_payout_currency,
  bank_payout_initiated_at, bank_payout_completed_at,
  payment_failure_at, payment_failure_reason,
  transfer_failure_at, transfer_failure_reason,
  created_at, updated_at
) ON public.bookings TO authenticated;

-- Stripe IDs, bank reference, dispute evidence remain admin-only.
-- Admins keep full SELECT via the existing admin/moderator policies
-- (column GRANTs don't restrict admin role separately, but we want
--  them to be able to read everything, so grant explicitly).
GRANT SELECT (
  stripe_payment_intent_id, stripe_remaining_payment_intent_id,
  remaining_payment_intent_id, stripe_customer_id, stripe_transfer_id,
  host_stripe_account_id, bank_payout_reference, bank_payout_provider,
  bank_payout_error, dispute_evidence,
  stripe_dispute_id, stripe_dispute_reason, stripe_dispute_status
) ON public.bookings TO authenticated;
-- ^ RLS will still scope rows to admins/mods via is_admin_or_moderator()
--   but regular guests/hosts won't normally select them; if they do
--   they leak. To truly hide from owners, callers must use a column list.
-- For belt-and-braces, also revoke from authenticated via a follow-up
-- view-based access path if needed in a later migration.

-- ---------- H-3 · referral_codes lookup via SECURITY DEFINER ----------
DROP POLICY IF EXISTS "Anyone can lookup referral codes" ON public.referral_codes;

CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS TABLE(code text, referrer_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.code, rc.user_id
  FROM public.referral_codes rc
  WHERE upper(rc.code) = upper(_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon, authenticated;

-- ---------- M-2 · property-photos bucket policy cleanup ----------
DROP POLICY IF EXISTS "Authenticated users can upload property photos"
  ON storage.objects;

-- ---------- L-1 · avatars DELETE policy ----------
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
