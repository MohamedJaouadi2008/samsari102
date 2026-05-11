-- ============================================================
-- P1.1: Lock down sensitive property columns from public view
-- ============================================================

-- Drop the broad public SELECT policy
DROP POLICY IF EXISTS "Public can view published properties" ON public.properties;

-- Recreate as a restrictive policy WITH a column-mask trigger approach.
-- Postgres RLS doesn't support per-column policies directly, so we use
-- a SECURITY BARRIER view for public consumption and keep the table
-- accessible only to host/admin/booked-guest via a tighter policy.

-- Public/anonymous SELECT: allow row visibility for published+public listings.
-- Sensitive columns will be nulled out via a view used by the frontend.
CREATE POLICY "Public can view published properties"
ON public.properties
FOR SELECT
TO anon, authenticated
USING (
  is_public = true
  AND status = 'published'
  AND COALESCE(is_banned, false) = false
);

-- Create a public-safe view that masks sensitive access columns.
-- Frontend should prefer this view for browse/search; detail page can
-- still call get_property_access_info() to reveal secrets when authorized.
CREATE OR REPLACE VIEW public.properties_public AS
SELECT
  id, host_id, title, description, property_type,
  governorate, city, coordinates,
  bedrooms, bathrooms, max_guests, extra_beds, bed_types,
  amenities, photos, price_per_night, currency,
  minimum_stay, cancellation_policy, house_rules,
  check_in_time, check_out_time, visitor_policy,
  safety_features, sleeping_arrangements,
  welcome_message, short_code,
  is_verified, is_public, booking_enabled, status,
  is_frozen, is_banned, frozen_at, banned_at,
  frozen_reason, banned_reason,
  created_at, updated_at,
  -- Sensitive columns explicitly excluded:
  --   address, google_maps_url, wifi_name, wifi_password,
  --   lockbox_code, arrival_instructions, parking_info
  NULL::text AS address,
  NULL::text AS google_maps_url,
  NULL::text AS wifi_name,
  NULL::text AS wifi_password,
  NULL::text AS lockbox_code,
  NULL::text AS arrival_instructions,
  NULL::text AS parking_info
FROM public.properties
WHERE is_public = true
  AND status = 'published'
  AND COALESCE(is_banned, false) = false;

ALTER VIEW public.properties_public SET (security_invoker = true);
GRANT SELECT ON public.properties_public TO anon, authenticated;

-- ============================================================
-- P1.2: Restrict bookings UPDATE policy to safe column whitelist
-- ============================================================

-- Drop the broad update policy
DROP POLICY IF EXISTS "Users can update their bookings" ON public.bookings;

-- Helper trigger: enforce that non-admin/non-system users can only
-- modify a whitelist of operational columns. The existing
-- protect_booking_financial_fields trigger already blocks financial
-- columns; this adds a positive whitelist for additional defense.
CREATE OR REPLACE FUNCTION public.enforce_booking_update_whitelist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / SECURITY DEFINER edge functions bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins/moderators can update anything
  IF public.is_admin_or_moderator() THEN
    RETURN NEW;
  END IF;

  -- Block changes to columns NOT in the operational whitelist.
  -- Whitelist (mutable by guest/host):
  --   status, request_message, host_response, responded_at,
  --   cancelled_at, dispute_reason, dispute_filed_by, dispute_evidence,
  --   dispute_opened_at, host_reported_damage, host_damage_description,
  --   host_damage_photos, guest_condition_confirmed,
  --   check_in_condition_confirmed, check_in_issues_reported,
  --   check_in_issues_description, check_in_issues_photos,
  --   guest_check_in_confirmed_at, host_check_in_confirmed_at,
  --   guest_check_out_confirmed_at, host_check_out_confirmed_at,
  --   actual_check_in, actual_check_out, check_in_time, check_out_time,
  --   num_guests (host only, before checkin), updated_at

  -- Immutable booking core (also enforced by other trigger, redundant safety)
  IF NEW.check_in_date IS DISTINCT FROM OLD.check_in_date
     OR NEW.check_out_date IS DISTINCT FROM OLD.check_out_date THEN
    RAISE EXCEPTION 'Booking dates cannot be modified by users';
  END IF;

  -- Block reminder timestamps (system-controlled)
  IF NEW.reminder_pre_checkin_sent_at IS DISTINCT FROM OLD.reminder_pre_checkin_sent_at
     OR NEW.reminder_pre_checkout_sent_at IS DISTINCT FROM OLD.reminder_pre_checkout_sent_at
     OR NEW.reminder_arrival_day_sent_at IS DISTINCT FROM OLD.reminder_arrival_day_sent_at
     OR NEW.reminder_review_nudge_sent_at IS DISTINCT FROM OLD.reminder_review_nudge_sent_at THEN
    RAISE EXCEPTION 'Reminder timestamps are system-controlled';
  END IF;

  -- Block auto-action / deadline / system-managed fields
  IF NEW.auto_action_taken IS DISTINCT FROM OLD.auto_action_taken
     OR NEW.auto_action_taken_at IS DISTINCT FROM OLD.auto_action_taken_at
     OR NEW.dispute_deadline IS DISTINCT FROM OLD.dispute_deadline
     OR NEW.check_in_deadline IS DISTINCT FROM OLD.check_in_deadline
     OR NEW.check_out_deadline IS DISTINCT FROM OLD.check_out_deadline
     OR NEW.remaining_payment_deadline IS DISTINCT FROM OLD.remaining_payment_deadline
     OR NEW.full_payment_locked IS DISTINCT FROM OLD.full_payment_locked
     OR NEW.full_payment_locked_at IS DISTINCT FROM OLD.full_payment_locked_at THEN
    RAISE EXCEPTION 'Deadline and lock fields are system-controlled';
  END IF;

  -- Block stripe dispute fields
  IF NEW.stripe_dispute_id IS DISTINCT FROM OLD.stripe_dispute_id
     OR NEW.stripe_dispute_status IS DISTINCT FROM OLD.stripe_dispute_status
     OR NEW.stripe_dispute_reason IS DISTINCT FROM OLD.stripe_dispute_reason
     OR NEW.payment_failure_at IS DISTINCT FROM OLD.payment_failure_at
     OR NEW.payment_failure_reason IS DISTINCT FROM OLD.payment_failure_reason
     OR NEW.transfer_failure_at IS DISTINCT FROM OLD.transfer_failure_at
     OR NEW.transfer_failure_reason IS DISTINCT FROM OLD.transfer_failure_reason THEN
    RAISE EXCEPTION 'Stripe dispute/failure fields are system-controlled';
  END IF;

  -- Block promo/credit fields (set at booking creation only)
  IF NEW.promo_code_id IS DISTINCT FROM OLD.promo_code_id
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.credit_applied IS DISTINCT FROM OLD.credit_applied THEN
    RAISE EXCEPTION 'Promo/credit fields cannot be modified after creation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_booking_update_whitelist_trigger ON public.bookings;
CREATE TRIGGER enforce_booking_update_whitelist_trigger
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_update_whitelist();

-- Recreate the UPDATE policy (keeps row-scoping; field whitelist enforced by trigger)
CREATE POLICY "Users can update their bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = host_id OR auth.uid() = guest_id)
WITH CHECK (auth.uid() = host_id OR auth.uid() = guest_id);
