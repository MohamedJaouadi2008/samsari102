-- L-01: 90-day retention for property_views (cleanup function callable by cron)
CREATE OR REPLACE FUNCTION public.purge_old_property_views()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.property_views
  WHERE viewed_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- M-02: server-side RPC so hosts fetch their own payout method through a single audited path
CREATE OR REPLACE FUNCTION public.get_my_payout_method()
RETURNS TABLE(
  payout_method text,
  bank_account_holder text,
  bank_rib text,
  bank_name text,
  stripe_account_id text,
  stripe_account_status text,
  stripe_onboarding_complete boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.payout_method, p.bank_account_holder, p.bank_rib, p.bank_name,
         p.stripe_account_id, p.stripe_account_status, p.stripe_onboarding_complete
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_payout_method() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payout_method() TO authenticated;

-- M-03: atomic promo code redemption (no race condition)
CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  _code text,
  _booking_id uuid,
  _discount_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_promo RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF _discount_amount IS NULL OR _discount_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- Atomic claim: increment uses_count only if a slot is available
  UPDATE public.promo_codes
     SET uses_count = uses_count + 1
   WHERE upper(code) = upper(_code)
     AND active = true
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR uses_count < max_uses)
  RETURNING * INTO v_promo;

  IF v_promo.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'promo_unavailable');
  END IF;

  -- Verify booking belongs to caller
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = _booking_id AND guest_id = v_user_id
  ) THEN
    -- Roll back the increment
    UPDATE public.promo_codes SET uses_count = uses_count - 1 WHERE id = v_promo.id;
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  INSERT INTO public.promo_redemptions (promo_code_id, user_id, booking_id, discount_amount)
  VALUES (v_promo.id, v_user_id, _booking_id, _discount_amount);

  RETURN jsonb_build_object('success', true, 'promo_code_id', v_promo.id);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text, uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid, numeric) TO authenticated;

-- M-04: prevent referral self-farming via shared phone number
-- Block reward when referrer & referred share the same phone (canonicalised, non-null)
CREATE OR REPLACE FUNCTION public.block_self_referral_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_phone text;
  v_referred_phone text;
BEGIN
  SELECT phone INTO v_referrer_phone FROM public.profiles WHERE id = NEW.referrer_id;
  SELECT phone INTO v_referred_phone FROM public.profiles WHERE id = NEW.referred_id;

  IF v_referrer_phone IS NOT NULL
     AND v_referred_phone IS NOT NULL
     AND regexp_replace(v_referrer_phone, '\s+', '', 'g') = regexp_replace(v_referred_phone, '\s+', '', 'g') THEN
    RAISE EXCEPTION 'Self-referral detected (matching phone)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_self_referral_by_phone ON public.referrals;
CREATE TRIGGER trg_block_self_referral_by_phone
BEFORE INSERT ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.block_self_referral_by_phone();