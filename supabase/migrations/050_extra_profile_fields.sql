-- Extra profielvelden
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_occupation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_area_m2 INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parking_needed BOOLEAN;
