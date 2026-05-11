
-- Referral codes (one per user)
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referral code" ON public.referral_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own referral code" ON public.referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can lookup referral codes" ON public.referral_codes FOR SELECT USING (true);

-- Referrals tracking
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_amount_tnd numeric NOT NULL DEFAULT 20,
  rewarded_at timestamptz,
  first_booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "Admins view all referrals" ON public.referrals FOR SELECT USING (is_admin_or_moderator());

-- User credit balance
CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY,
  balance_tnd numeric NOT NULL DEFAULT 0,
  total_earned_tnd numeric NOT NULL DEFAULT 0,
  total_spent_tnd numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all credits" ON public.user_credits FOR SELECT USING (is_admin_or_moderator());

-- Credit transactions audit
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_tnd numeric NOT NULL,
  type text NOT NULL,
  reason text,
  related_booking_id uuid,
  related_referral_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.credit_transactions FOR SELECT USING (is_admin_or_moderator());

-- Promo codes
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL,
  discount_value numeric NOT NULL,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  min_booking_amount numeric DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active promo codes" ON public.promo_codes FOR SELECT USING (active = true);
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL USING (is_admin_or_moderator()) WITH CHECK (is_admin_or_moderator());

-- Promo redemptions
CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL,
  user_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  discount_amount numeric NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own redemptions" ON public.promo_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own redemptions" ON public.promo_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all redemptions" ON public.promo_redemptions FOR SELECT USING (is_admin_or_moderator());

-- Booking columns for promo + credit
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS promo_code_id uuid,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_applied numeric DEFAULT 0;

-- Superhost columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_superhost boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS superhost_since timestamptz;

-- Indexes
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_promo_codes_code ON public.promo_codes(code) WHERE active = true;
