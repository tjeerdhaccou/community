-- Woningnummer per lid
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS housing_unit TEXT;
CREATE INDEX IF NOT EXISTS idx_memberships_housing ON memberships(housing_unit) WHERE housing_unit IS NOT NULL;

-- Pinned updates
ALTER TABLE updates ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Configureerbare checklist stappen per project
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  auto_email_subject TEXT,
  auto_email_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_project ON checklist_templates(project_id);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_admins_checklist_templates" ON checklist_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = checklist_templates.project_id
      AND memberships.profile_id = auth.uid()
      AND memberships.role IN ('admin', 'moderator')
    )
    OR is_platform_admin()
  );

-- Checklist voortgang per lid
CREATE TABLE IF NOT EXISTS checklist_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_progress_profile ON checklist_progress(profile_id, project_id);

ALTER TABLE checklist_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_admins_checklist_progress" ON checklist_progress
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = checklist_progress.project_id
      AND memberships.profile_id = auth.uid()
      AND memberships.role IN ('admin', 'moderator')
    )
    OR is_platform_admin()
  );

-- Leden kunnen hun eigen voortgang zien
CREATE POLICY "member_own_checklist" ON checklist_progress
  FOR SELECT
  USING (profile_id = auth.uid());
