-- Top 3 woningvoorkeuren per lid per project
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS housing_preferences JSONB DEFAULT '[]'::jsonb;
