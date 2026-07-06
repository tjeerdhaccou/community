-- Fasen als groepering boven checklist_templates
CREATE TABLE IF NOT EXISTS checklist_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_phases_project ON checklist_phases(project_id);

ALTER TABLE checklist_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_admins_checklist_phases" ON checklist_phases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = checklist_phases.project_id
      AND memberships.profile_id = auth.uid()
      AND memberships.role IN ('admin', 'moderator')
    )
    OR is_platform_admin()
  );

-- Leden kunnen fasen zien
CREATE POLICY "members_view_checklist_phases" ON checklist_phases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = checklist_phases.project_id
      AND memberships.profile_id = auth.uid()
    )
  );

-- Koppel templates aan fasen
ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES checklist_phases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_checklist_templates_phase ON checklist_templates(phase_id);

-- Voortgang voor fasen zonder stappen (fase zelf is de stap)
CREATE TABLE IF NOT EXISTS checklist_phase_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES checklist_phases(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phase_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_phase_progress_profile ON checklist_phase_progress(profile_id, project_id);

ALTER TABLE checklist_phase_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_admins_phase_progress" ON checklist_phase_progress
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = checklist_phase_progress.project_id
      AND memberships.profile_id = auth.uid()
      AND memberships.role IN ('admin', 'moderator')
    )
    OR is_platform_admin()
  );

CREATE POLICY "member_own_phase_progress" ON checklist_phase_progress
  FOR SELECT
  USING (profile_id = auth.uid());
