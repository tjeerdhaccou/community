-- 027_project_features.sql
-- Per-project feature toggles. Defaults all-on so existing projects keep working.
-- Managed by org admins from the org dashboard.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{
    "updates": true,
    "board": true,
    "events": true,
    "roadmap": true,
    "members": true,
    "documents": true,
    "team": true,
    "page_builder": true,
    "ledenwerving": true
  }'::jsonb;

-- Make sure existing rows have the defaults (in case the column was added without default before)
UPDATE projects
SET features = '{
  "updates": true,
  "board": true,
  "events": true,
  "roadmap": true,
  "members": true,
  "documents": true,
  "team": true,
  "page_builder": true,
  "ledenwerving": true
}'::jsonb
WHERE features IS NULL OR features = '{}'::jsonb;
