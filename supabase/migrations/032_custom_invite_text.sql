-- Customizable invite-email tekst, cascade van organisatie naar project.
-- Bij verzenden van een type='invite' mail kiest de edge function:
--   project.invite_intro_text > organization.invite_intro_text > default
--
-- Beschikbare placeholders in de tekst: {naam}, {projectnaam}.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS invite_intro_text text;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS invite_intro_text text;
