-- check_invited_email accepteert nu een optionele subdomain slug. Op een
-- org/project subdomain checken we of de user toegang heeft tot DIE org
-- of dat project. Op het hoofddomain blijft het generiek.
--
-- Voorkomt dat verwijderde admins (die nog in profiles staan) een OTP-mail
-- krijgen voor een subdomain waar ze geen toegang meer toe hebben.

DROP FUNCTION IF EXISTS check_invited_email(text);

CREATE OR REPLACE FUNCTION check_invited_email(
  p_email text,
  p_subdomain_slug text DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  e text := lower(trim(p_email));
  org_id_v uuid;
  project_id_v uuid;
BEGIN
  -- Platform admins mogen altijd inloggen
  IF EXISTS (
    SELECT 1 FROM profiles WHERE lower(email) = e AND is_platform_admin = true
  ) THEN RETURN true; END IF;

  IF p_subdomain_slug IS NOT NULL THEN
    SELECT id INTO org_id_v FROM organizations WHERE slug = p_subdomain_slug;
    SELECT id INTO project_id_v FROM projects WHERE slug = p_subdomain_slug;
  END IF;

  IF org_id_v IS NOT NULL THEN
    -- Org subdomain: alleen door als user toegang heeft tot DEZE org
    IF EXISTS (
      SELECT 1 FROM org_members om
      JOIN profiles p ON p.id = om.profile_id
      WHERE lower(p.email) = e AND om.organization_id = org_id_v
    ) THEN RETURN true; END IF;
    IF EXISTS (
      SELECT 1 FROM org_admin_invites
      WHERE lower(email) = e AND organization_id = org_id_v AND status = 'pending'
    ) THEN RETURN true; END IF;
    RETURN false;
  END IF;

  IF project_id_v IS NOT NULL THEN
    -- Project subdomain: alleen door als user toegang heeft tot DIT project
    IF EXISTS (
      SELECT 1 FROM memberships m
      JOIN profiles p ON p.id = m.profile_id
      WHERE lower(p.email) = e AND m.project_id = project_id_v
    ) THEN RETURN true; END IF;
    IF EXISTS (
      SELECT 1 FROM member_invites
      WHERE lower(email) = e AND project_id = project_id_v AND status = 'pending'
    ) THEN RETURN true; END IF;
    IF EXISTS (
      SELECT 1 FROM intake_responses
      WHERE lower(email) = e AND project_id = project_id_v AND status = 'invited'
    ) THEN RETURN true; END IF;
    -- Org admins van de owning org mogen ook
    IF EXISTS (
      SELECT 1 FROM org_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN projects pr ON pr.organization_id = om.organization_id
      WHERE lower(p.email) = e AND pr.id = project_id_v
    ) THEN RETURN true; END IF;
    RETURN false;
  END IF;

  -- Hoofddomain (geen subdomain): bestaande user of openstaande invite
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = e) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM member_invites WHERE lower(email) = e AND status = 'pending') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM intake_responses WHERE lower(email) = e AND status = 'invited') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM org_admin_invites WHERE lower(email) = e AND status = 'pending') THEN RETURN true; END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
