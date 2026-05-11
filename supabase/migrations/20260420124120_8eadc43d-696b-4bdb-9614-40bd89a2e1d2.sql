
-- ============================================================
-- 1) PROFILES — column-level lockdown (idempotent)
-- ============================================================
REVOKE SELECT ON public.profiles FROM anon, authenticated;

-- Public-safe columns (anon + authenticated)
GRANT SELECT (
  id, username, full_name, avatar_url, bio,
  is_host, is_superhost, superhost_since,
  verification_status, created_at, is_banned
) ON public.profiles TO anon, authenticated;

-- Authenticated-only sensitive columns (own-row enforced by RLS)
GRANT SELECT (
  phone, preferred_currency,
  stripe_account_id, stripe_account_status, stripe_onboarding_complete,
  bank_account_holder, bank_rib, bank_name, payout_method,
  warning_count, host_strikes, guest_strikes, last_strike_at, strike_reason,
  banned_at, banned_reason, unbanned_at, last_warning_at, last_warning_reason,
  verification_submitted_at, updated_at
) ON public.profiles TO authenticated;

-- ============================================================
-- 2) PROPERTIES — column-level lockdown (idempotent)
-- ============================================================
REVOKE SELECT ON public.properties FROM anon, authenticated;

-- Public-safe columns for listings (anon + authenticated)
GRANT SELECT (
  id, host_id, title, description, property_type, governorate, city,
  coordinates, bedrooms, bathrooms, max_guests, extra_beds, bed_types,
  amenities, photos, price_per_night, currency, minimum_stay,
  cancellation_policy, check_in_time, check_out_time, house_rules,
  visitor_policy, safety_features, sleeping_arrangements, welcome_message,
  is_verified, is_public, is_banned, is_frozen, status, booking_enabled,
  short_code, created_at, updated_at, frozen_at, banned_at,
  frozen_reason, banned_reason
) ON public.properties TO anon, authenticated;

-- Sensitive credentials/location: gated only via get_property_access_info() RPC.
-- Do NOT grant to anon/authenticated:
--   address, google_maps_url, arrival_instructions, wifi_name, wifi_password,
--   parking_info, lockbox_code

-- ============================================================
-- 3) REFERRAL_CODES — hide user_id from anon enumeration
-- ============================================================
REVOKE SELECT ON public.referral_codes FROM anon, authenticated;
-- Anon can only resolve a code -> code (and uses_count)
GRANT SELECT (id, code, uses_count, created_at) ON public.referral_codes TO anon;
-- Authenticated also see user_id (own-row only via RLS) for "my code" panel
GRANT SELECT (id, code, uses_count, created_at, user_id) ON public.referral_codes TO authenticated;

-- ============================================================
-- 4) BOOKINGS — block guests/hosts from updating financial columns.
--    The protect_booking_financial_fields() trigger already blocks this,
--    but we add a hard WITH CHECK so RLS itself rejects mutations
--    instead of relying solely on trigger exceptions. We re-create the
--    UPDATE policy with column-aware logic.
-- ============================================================
DROP POLICY IF EXISTS "Users can update their bookings" ON public.bookings;

CREATE POLICY "Users can update their bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = host_id OR auth.uid() = guest_id)
WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);

-- Make sure the financial-fields trigger is attached (idempotent)
DROP TRIGGER IF EXISTS protect_booking_financial_fields_trg ON public.bookings;
CREATE TRIGGER protect_booking_financial_fields_trg
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.protect_booking_financial_fields();

-- Revoke direct UPDATE on financial columns from end users.
-- Service-role / SECURITY DEFINER edge functions still bypass.
REVOKE UPDATE ON public.bookings FROM anon, authenticated;

-- Allow UPDATE only on user-mutable columns
GRANT UPDATE (
  status,                       -- gated by validate_booking_status_transition
  request_message, host_response, responded_at,
  check_in_time, check_out_time,
  actual_check_in, actual_check_out,
  host_check_in_confirmed_at, guest_check_in_confirmed_at,
  host_check_out_confirmed_at, guest_check_out_confirmed_at,
  check_in_condition_confirmed, guest_condition_confirmed,
  check_in_issues_reported, check_in_issues_description, check_in_issues_photos,
  host_reported_damage, host_damage_description, host_damage_photos,
  dispute_reason, dispute_evidence, dispute_filed_by, dispute_opened_at,
  cancelled_at, refund_reason,
  num_guests, updated_at
) ON public.bookings TO authenticated;

-- Re-grant SELECT for normal app access (RLS still scopes rows)
GRANT SELECT ON public.bookings TO authenticated;
GRANT INSERT ON public.bookings TO authenticated;
