-- Fix: allow org admins and moderators to add/remove members in workgroups
-- Current policy only allows self-join (profile_id = auth.uid())

CREATE POLICY "Admins can manage workgroup members"
  ON workgroup_members FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workgroups w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = workgroup_id
        AND (is_org_admin(p.organization_id) OR has_membership(w.project_id, 'moderator'))
    )
  );

-- Also allow admins to remove others
DROP POLICY IF EXISTS "Members can leave workgroups" ON workgroup_members;

CREATE POLICY "Members can leave or be removed from workgroups"
  ON workgroup_members FOR DELETE USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workgroups w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = workgroup_id
        AND (is_org_admin(p.organization_id) OR has_membership(w.project_id, 'moderator'))
    )
  );
