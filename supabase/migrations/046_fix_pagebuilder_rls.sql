-- ============================================================================
-- Fix RLS policies voor de page-builder.
--
-- Migratie 019 schreef direct SELECT-queries op `memberships` met role='admin'.
-- Dat sluit org-admins en platform-admins uit als ze geen fysieke admin-rij
-- op het project hebben — wat in de praktijk vaak het geval is (org admins
-- krijgen impliciet admin-toegang via `has_membership()`, platform admins
-- via `is_platform_admin()`).
--
-- Effect bij Tjeerd vandaag: 403 op insert/update van public_sections vanuit
-- de Pagina Bouwer.
-- ============================================================================

-- public_sections — INSERT
DROP POLICY IF EXISTS "Admins can insert public sections" ON public_sections;
CREATE POLICY "Admins can insert public sections"
  ON public_sections FOR INSERT WITH CHECK (
    has_membership(project_id, 'admin') OR is_platform_admin()
  );

-- public_sections — UPDATE
DROP POLICY IF EXISTS "Admins can update public sections" ON public_sections;
CREATE POLICY "Admins can update public sections"
  ON public_sections FOR UPDATE USING (
    has_membership(project_id, 'admin') OR is_platform_admin()
  );

-- public_sections — DELETE
DROP POLICY IF EXISTS "Admins can delete public sections" ON public_sections;
CREATE POLICY "Admins can delete public sections"
  ON public_sections FOR DELETE USING (
    has_membership(project_id, 'admin') OR is_platform_admin()
  );

-- projects — UPDATE (al via is_org_admin + has_membership, maar platform admin ontbrak)
DROP POLICY IF EXISTS "Org admins and project admins can update projects" ON projects;
CREATE POLICY "Org admins, project admins and platform admins can update projects"
  ON projects FOR UPDATE USING (
    is_org_admin(organization_id) OR has_membership(id, 'admin') OR is_platform_admin()
  );
