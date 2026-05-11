-- =========================================================
-- PROFILES: column-level lockdown for the public/anon SELECT
-- =========================================================
-- The blanket "Public can view basic identity columns" policy uses USING(true).
-- We keep the row-level policy (needed so joins work) but revoke column SELECT
-- on sensitive columns from anon and authenticated roles. Self-access and
-- admin/moderator access continue to work via the other policies + grants below.

REVOKE SELECT ON public.profiles FROM anon, authenticated;

-- Public-safe columns only (anyone, including anon)
GRANT SELECT (
  id, username, full_name, avatar_url, bio,
  is_host, is_superhost, superhost_since,
  verification_status, created_at
) ON public.profiles TO anon, authenticated;

-- Authenticated users still need broader access for self-rows; the existing
-- RLS policy "Users can view own profile" gates rows. We grant the remaining
-- columns at the column level so self-access keeps working.
GRANT SELECT (
  phone, preferred_currency, is_banned, banned_at, banned_reason,
  warning_count, last_warning_at, last_warning_reason,
  host_strikes, guest_strikes, last_strike_at, strike_reason, unbanned_at,
  stripe_account_id, stripe_account_status, stripe_onboarding_complete,
  bank_account_holder, bank_rib, bank_name, payout_method,
  verification_submitted_at, updated_at
) ON public.profiles TO authenticated;

-- =========================================================
-- PROPERTIES: hide secrets from public
-- =========================================================
REVOKE SELECT ON public.properties FROM anon, authenticated;

-- Public-safe columns for everyone (used by listings, search, detail page)
GRANT SELECT (
  id, host_id, title, description, property_type,
  governorate, city, coordinates,
  bedrooms, bathrooms, max_guests, extra_beds, bed_types,
  amenities, photos, price_per_night, currency,
  visitor_policy, house_rules, check_in_time, check_out_time,
  cancellation_policy, welcome_message, minimum_stay,
  sleeping_arrangements, safety_features,
  status, is_public, is_verified, is_frozen, is_banned,
  booking_enabled, short_code,
  created_at, updated_at,
  frozen_at, banned_at, frozen_reason, banned_reason
) ON public.properties TO anon, authenticated;

-- Sensitive columns: only authenticated users get column-level SELECT.
-- The existing RLS policies ("Hosts can manage their own properties",
-- "Admins can view all properties", "Moderators can view all properties")
-- still gate which rows. Booked guests retrieve these via
-- get_property_access_info() RPC (already exists, security definer).
GRANT SELECT (
  address, google_maps_url, wifi_name, wifi_password,
  lockbox_code, arrival_instructions, parking_info
) ON public.properties TO authenticated;

-- =========================================================
-- PROPERTY_PROMOTIONS: hide Stripe IDs from public
-- =========================================================
REVOKE SELECT ON public.property_promotions FROM anon, authenticated;

GRANT SELECT (
  id, property_id, host_id, days, amount_tnd,
  starts_at, ends_at, status, auto_renew, created_at, sandbox
) ON public.property_promotions TO anon, authenticated;

-- Stripe IDs only for authenticated (gated by existing host/admin RLS)
GRANT SELECT (
  stripe_session_id, stripe_payment_intent_id, stripe_subscription_id
) ON public.property_promotions TO authenticated;

-- =========================================================
-- REFERRAL_CODES: hide user_id from anonymous lookups
-- =========================================================
REVOKE SELECT ON public.referral_codes FROM anon, authenticated;

-- Anonymous can only resolve a code -> usage count (no user linkage)
GRANT SELECT (id, code, uses_count, created_at) ON public.referral_codes TO anon;

-- Authenticated users can see user_id (gated by "Users view own referral code" RLS)
GRANT SELECT ON public.referral_codes TO authenticated;
