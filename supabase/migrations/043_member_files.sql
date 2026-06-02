-- Persoonlijke dossiers: bestanden per lid, beheerd vanuit het CMS
CREATE TABLE member_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  category TEXT NOT NULL DEFAULT 'overig',
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  is_visible_to_member BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index voor snel opzoeken per lid
CREATE INDEX idx_member_files_profile ON member_files(profile_id);
CREATE INDEX idx_member_files_project ON member_files(project_id);

-- RLS
ALTER TABLE member_files ENABLE ROW LEVEL SECURITY;

-- Admins/moderators van het project kunnen alles
CREATE POLICY "project_admins_all" ON member_files
  FOR ALL
  USING (
    has_membership(project_id, 4) -- moderator of hoger
    OR is_platform_admin()
  );

-- Leden kunnen hun eigen bestanden zien als is_visible_to_member = true
CREATE POLICY "member_own_files_read" ON member_files
  FOR SELECT
  USING (
    profile_id = auth.uid()
    AND is_visible_to_member = true
  );

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON member_files
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);
