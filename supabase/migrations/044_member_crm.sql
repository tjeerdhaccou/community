-- CRM: tijdlijn notities en funnel stages per lid

-- Funnel stage op membership niveau
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS funnel_stage TEXT DEFAULT 'nieuw'
  CHECK (funnel_stage IN ('nieuw', 'orienterend', 'aspirant_koper', 'koper', 'bewoner'));

-- Tijdlijn / contactmomenten per lid
CREATE TABLE member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL DEFAULT 'note'
    CHECK (type IN ('note', 'call', 'email_sent', 'email_received', 'meeting', 'status_change', 'system')),
  subject TEXT,
  body TEXT NOT NULL,
  email_to TEXT,
  email_from TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_notes_profile ON member_notes(profile_id, project_id);
CREATE INDEX idx_member_notes_project ON member_notes(project_id);

ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_admins_all" ON member_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = member_notes.project_id
      AND memberships.profile_id = auth.uid()
      AND memberships.role IN ('admin', 'moderator')
    )
    OR is_platform_admin()
  );
