-- Add custom_domain column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_domain TEXT;
