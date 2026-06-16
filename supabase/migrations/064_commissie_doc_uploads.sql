-- ============================================================================
-- Commissie-leden mogen documenten beheren binnen hun eigen commissie
-- ============================================================================
-- Besluit: niet de project-brede 'moderator'-rol toekennen aan commissieleden
-- (te ruim), maar een gerichte capability. Een lid van een werkgroep met
-- type='commissie' mag group-scoped documenten aanmaken en die koppelen aan
-- commissies waar het zelf in zit. Doelgroep-leden krijgen niets extra.
-- Echte beheerrechten blijven bij admin/moderator.

-- 1. Helpers (SECURITY DEFINER zodat ze workgroup_members mogen lezen) --------

-- Zit de huidige gebruiker in MINSTENS ÉÉN commissie binnen dit project?
CREATE OR REPLACE FUNCTION is_commissie_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workgroup_members wm
    JOIN workgroups w ON w.id = wm.workgroup_id
    WHERE wm.profile_id = auth.uid()
      AND w.project_id = p_project_id
      AND w.type = 'commissie'
  );
$$;

-- Zit de huidige gebruiker in DEZE specifieke commissie?
CREATE OR REPLACE FUNCTION is_member_of_commissie(p_workgroup_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workgroup_members wm
    JOIN workgroups w ON w.id = wm.workgroup_id
    WHERE wm.profile_id = auth.uid()
      AND wm.workgroup_id = p_workgroup_id
      AND w.type = 'commissie'
  );
$$;

GRANT EXECUTE ON FUNCTION is_commissie_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_member_of_commissie(uuid) TO authenticated;

-- 2. documents: INSERT — commissieleden mogen group-scoped docs aanmaken ------
-- visibility='groups' verplicht voor de commissie-route, zodat een commissielid
-- nooit project-brede (public/members) documenten kan publiceren.
DROP POLICY IF EXISTS "Admins and moderators can create documents" ON documents;
CREATE POLICY "Documents insert: admins, moderators, commissie"
  ON documents FOR INSERT WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'moderator')
    OR (visibility = 'groups' AND is_commissie_member(project_id))
  );

-- 3. documents: UPDATE — commissieleden mogen hun EIGEN uploads bijwerken -----
DROP POLICY IF EXISTS "Admins and moderators can update documents" ON documents;
CREATE POLICY "Documents update: admins, moderators, own commissie uploads"
  ON documents FOR UPDATE USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'moderator')
    OR (uploaded_by = auth.uid() AND is_commissie_member(project_id))
  );

-- 4. documents: DELETE — commissieleden mogen hun EIGEN uploads verwijderen ---
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Documents delete: admins, own commissie uploads"
  ON documents FOR DELETE USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'admin')
    OR (uploaded_by = auth.uid() AND is_commissie_member(project_id))
  );

-- 5. document_groups: INSERT — koppelen mag alleen aan EIGEN commissie --------
-- Hier wordt de scope echt afgedwongen: een commissielid kan een document
-- uitsluitend koppelen aan een commissie waar het zelf lid van is.
DROP POLICY IF EXISTS "Org admins and moderators can manage document groups" ON document_groups;
CREATE POLICY "Document groups insert: admins, moderators, own commissie"
  ON document_groups FOR INSERT WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = document_id
        AND (is_org_admin(p.organization_id) OR has_membership(d.project_id, 'moderator'))
    )
    OR is_member_of_commissie(workgroup_id)
  );

-- 6. document_groups: DELETE — ontkoppelen mag binnen EIGEN commissie ---------
DROP POLICY IF EXISTS "Org admins and moderators can delete document groups" ON document_groups;
CREATE POLICY "Document groups delete: admins, moderators, own commissie"
  ON document_groups FOR DELETE USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = document_id
        AND (is_org_admin(p.organization_id) OR has_membership(d.project_id, 'moderator'))
    )
    OR is_member_of_commissie(workgroup_id)
  );
