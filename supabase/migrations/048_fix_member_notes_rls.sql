-- Fix: org admins konden geen member_notes aanmaken/lezen
-- omdat de policy alleen op memberships checkte, niet op org_members.
DROP POLICY IF EXISTS "project_admins_all" ON member_notes;
CREATE POLICY "project_admins_all" ON member_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.project_id = member_notes.project_id
      AND memberships.profile_id = auth.uid()
      AND memberships.role IN ('admin', 'moderator')
    )
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = member_notes.project_id
      AND is_org_admin(p.organization_id)
    )
    OR is_platform_admin()
  );

-- Zelfde fix voor member_files als dat dezelfde structuur heeft
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_files' AND policyname = 'project_admins_all') THEN
    DROP POLICY "project_admins_all" ON member_files;
    CREATE POLICY "project_admins_all" ON member_files
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM memberships
          WHERE memberships.project_id = member_files.project_id
          AND memberships.profile_id = auth.uid()
          AND memberships.role IN ('admin', 'moderator')
        )
        OR EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = member_files.project_id
          AND is_org_admin(p.organization_id)
        )
        OR is_platform_admin()
      );
  END IF;
END $$;
