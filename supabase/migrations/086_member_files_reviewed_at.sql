-- Track wanneer een moderator/admin de zelf-upload van een lid heeft gezien.
-- Wordt gebruikt voor een "nieuwe uploads" badge in de sidebar (Leden) + dot
-- op de Dossier-tab en per lid in de ledenlijst.
--
-- reviewed_at IS NULL = ongelezen door team
-- reviewed_at IS NOT NULL = door team gezien (moment van eerste opening dossier)
--
-- Alleen relevant voor zelf-uploads (uploaded_by = profile_id). Bestanden die
-- het team zelf heeft geüpload zijn per definitie al 'gezien'.

ALTER TABLE member_files
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Bestaande zelf-uploads markeren als al gezien — anders knallen bij deploy
-- alle historische uploads als 'ongelezen' in de UI.
UPDATE member_files
  SET reviewed_at = COALESCE(reviewed_at, now())
  WHERE uploaded_by = profile_id;

-- Partiële index voor de sidebar-query (zoekt alleen ongelezen zelf-uploads).
CREATE INDEX IF NOT EXISTS member_files_unreviewed_self_uploads_idx
  ON member_files (project_id, profile_id)
  WHERE reviewed_at IS NULL AND uploaded_by = profile_id;
