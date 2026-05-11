-- Member invites: persoonlijke uitnodiging door admin/moderator
-- Komt naast intake_responses te staan. Beide eindigen na signup in een
-- membership met role 'guest' via de auto-link trigger (zie 029).

CREATE TABLE IF NOT EXISTS member_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  name text,
  invited_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_member_invites_email ON member_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_member_invites_project ON member_invites (project_id);

ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;

-- Moderators+ in het project beheren invites
CREATE POLICY "Moderators can read invites"
  ON member_invites FOR SELECT USING (
    is_platform_admin() OR has_membership(project_id, 'moderator')
  );

CREATE POLICY "Moderators can create invites"
  ON member_invites FOR INSERT WITH CHECK (
    is_platform_admin() OR has_membership(project_id, 'moderator')
  );

CREATE POLICY "Moderators can update invites"
  ON member_invites FOR UPDATE USING (
    is_platform_admin() OR has_membership(project_id, 'moderator')
  );

CREATE POLICY "Admins can delete invites"
  ON member_invites FOR DELETE USING (
    is_platform_admin() OR has_membership(project_id, 'admin')
  );
