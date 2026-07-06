-- Add partner contact fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS partner_email text,
  ADD COLUMN IF NOT EXISTS partner_phone text,
  ADD COLUMN IF NOT EXISTS partner_date_of_birth date,
  ADD COLUMN IF NOT EXISTS partner_gender text;
