-- Alleen platform admins (superadmins) mogen org admins verwijderen.
-- Org admins kunnen wel nieuwe admins uitnodigen, maar geen bestaande
-- admins eraf gooien. Voorkomt dat een org admin per ongeluk of bewust
-- mede-admins (incl. platform admin) kicked.

DROP POLICY IF EXISTS "Org admins en platform admins kunnen verwijderen" ON org_members;

CREATE POLICY "Alleen platform admins kunnen verwijderen"
  ON org_members FOR DELETE USING (
    is_platform_admin()
  );
