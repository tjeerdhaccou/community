-- Migration 017: CrowdBuilding-thema toestaan als standaard thema
-- Voegt 'crowdbuilding' toe aan de toegestane default_theme-waarden zodat
-- het thema in Instellingen gekozen en opgeslagen kan worden.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_default_theme_check;
ALTER TABLE projects ADD CONSTRAINT projects_default_theme_check
  CHECK (default_theme IN ('light', 'warm', 'dark', 'contrast', 'crowdbuilding'));
