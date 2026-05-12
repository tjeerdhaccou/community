-- Platform admins moeten org admins kunnen toevoegen, wijzigen en
-- verwijderen — ook als ze zelf geen org_members row hebben. De bestaande
-- INSERT/UPDATE/DELETE policies op org_members checken alleen op
-- is_org_admin(), dus platform admins werden geblokkeerd.

DROP POLICY IF EXISTS "Org admins can manage org members" ON org_members;
DROP POLICY IF EXISTS "Org admins can update org members" ON org_members;
DROP POLICY IF EXISTS "Org admins can remove org members" ON org_members;

CREATE POLICY "Org admins en platform admins kunnen toevoegen"
  ON org_members FOR INSERT WITH CHECK (
    is_platform_admin() OR is_org_admin(organization_id)
  );

CREATE POLICY "Org admins en platform admins kunnen updaten"
  ON org_members FOR UPDATE USING (
    is_platform_admin() OR is_org_admin(organization_id)
  );

CREATE POLICY "Org admins en platform admins kunnen verwijderen"
  ON org_members FOR DELETE USING (
    is_platform_admin() OR is_org_admin(organization_id)
  );
