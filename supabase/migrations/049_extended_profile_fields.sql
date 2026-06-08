-- Uitgebreide profielvelden voor woningprojecten
-- Adres
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;

-- Persoonlijk
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;

-- Gezinssituatie
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS num_children INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS children_ages TEXT; -- bijv. "3, 7, 12"

-- Woonsituatie
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_housing_type TEXT; -- huur/koop/anders
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS housing_preference TEXT; -- koop/huur/flexibel
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_budget TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_rooms INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accessibility_needs TEXT;

-- Werk & inkomen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employer TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS income_indication TEXT; -- bandbreedte

-- Motivatie
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT; -- wat kan het lid bijdragen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability TEXT; -- hoeveel tijd per week

-- Noodcontact
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Admin notities (alleen zichtbaar voor admins)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;
