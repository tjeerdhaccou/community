-- Fix: alle member_files policies gebruikten has_membership(uuid, integer)
-- maar de functie verwacht has_membership(uuid, text). Opnieuw aanmaken.
-- Ook: storage bucket 'member-files' ontbrak volledig.

-- ============================================================================
-- Storage bucket voor member-files (privé — alleen via signed URLs)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-files', 'member-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload member files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'member-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read member files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete member files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'member-files' AND auth.role() = 'authenticated');

-- ============================================================================
-- Tabel RLS fixes
-- ============================================================================

DROP POLICY IF EXISTS "project_admins_all" ON member_files;
DROP POLICY IF EXISTS "member_own_files_read" ON member_files;
DROP POLICY IF EXISTS "member_self_insert" ON member_files;
DROP POLICY IF EXISTS "member_self_delete" ON member_files;

-- Admins/moderators kunnen alles
CREATE POLICY "project_admins_all" ON member_files
  FOR ALL
  USING (
    has_membership(project_id, 'moderator')
    OR is_platform_admin()
  )
  WITH CHECK (
    has_membership(project_id, 'moderator')
    OR is_platform_admin()
  );

-- Leden zien hun eigen bestanden (als zichtbaar)
CREATE POLICY "member_own_files_read" ON member_files
  FOR SELECT
  USING (
    profile_id = auth.uid()
    AND is_visible_to_member = true
  );

-- Leden mogen hun eigen bestanden uploaden
CREATE POLICY "member_self_insert" ON member_files
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND has_membership(project_id, 'guest')
  );

-- Leden mogen hun eigen uploads verwijderen
CREATE POLICY "member_self_delete" ON member_files
  FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND profile_id = auth.uid()
  );
