-- De bestaande SELECT-policy op org_members deed een subquery op zichzelf
-- (`organization_id IN (SELECT organization_id FROM org_members WHERE ...)`).
-- Postgres past RLS recursief toe op die subquery, waardoor een admin
-- alleen zijn eigen rij zag in plaats van alle org admins.
--
-- Fix: gebruik de bestaande is_org_admin() helper. Die is SECURITY DEFINER
-- en bypass't RLS van binnenuit. Ook is_platform_admin() toevoegen zodat
-- platform admins de lijst altijd kunnen lezen.

ALTER FUNCTION is_org_admin(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION is_platform_admin() SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "Org members can read own org members" ON org_members;

CREATE POLICY "Org admins can read org members"
  ON org_members FOR SELECT USING (
    is_platform_admin() OR is_org_admin(organization_id)
  );
