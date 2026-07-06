-- Add slug to organizations for friendly URLs
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Set slug from name for existing orgs
UPDATE organizations SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug required going forward
ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;
