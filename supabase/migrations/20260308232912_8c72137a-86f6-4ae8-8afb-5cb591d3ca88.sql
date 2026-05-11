
-- Add bank payout fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payout_method text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS bank_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_rib text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_holder text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN profiles.payout_method IS 'Payout method: none, stripe, bank_transfer';
COMMENT ON COLUMN profiles.bank_rib IS 'RIB or IBAN number for bank transfers';
