-- Migration 062: CrowdBuilding-thema + thema-cascade (platform → org → project)
--
-- 1. 'crowdbuilding' toestaan als thema-waarde op projecten.
-- 2. default_theme op organisatie-niveau (NULL = geen voorkeur).
-- 3. Projecten mogen NULL als default_theme hebben → "erf van organisatie".
-- 4. RLS zodat projectleden het thema van hun project-organisatie kunnen lezen
--    (nodig om de cascade voor élke bezoeker te resolven).

-- 1. Project-constraint uitbreiden met 'crowdbuilding' (en NULL toestaan = erf van org)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_default_theme_check;
ALTER TABLE projects ADD CONSTRAINT projects_default_theme_check
  CHECK (default_theme IS NULL OR default_theme IN ('light', 'warm', 'dark', 'contrast', 'crowdbuilding'));

-- 2. Organisatie-thema
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_theme text;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_default_theme_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_default_theme_check
  CHECK (default_theme IS NULL OR default_theme IN ('light', 'warm', 'dark', 'contrast', 'crowdbuilding'));

-- 3. Helper (SECURITY DEFINER) — is de huidige gebruiker lid van een project binnen deze org?
--    Bypasst RLS op projects/memberships om recursie te voorkomen (zelfde patroon als has_membership()).
CREATE OR REPLACE FUNCTION is_member_of_org(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    JOIN memberships m ON m.project_id = p.id
    WHERE p.organization_id = org_id
      AND m.profile_id = auth.uid()
  );
$$;

-- 4. Projectleden mogen de organisatie van hun project lezen (voor de thema-cascade)
DROP POLICY IF EXISTS "Project members can read their project org" ON organizations;
CREATE POLICY "Project members can read their project org"
  ON organizations FOR SELECT USING (is_member_of_org(id));
