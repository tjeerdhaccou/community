-- check_invited_email keek alleen naar member_invites en intake_responses
-- (project-flow). Org admins zitten in org_admin_invites en kregen daardoor
-- "niet uitgenodigd" op de login pagina. Ook bestaande users (incl.
-- platform admins) moeten gewoon kunnen inloggen.
--
-- Nieuwe logica: allow als email matcht in een van:
--   - profiles.email (bestaande user, inclusief platform admin)
--   - member_invites (pending project invite)
--   - intake_responses (invited intake response)
--   - org_admin_invites (pending org admin invite)

CREATE OR REPLACE FUNCTION check_invited_email(p_email text)
RETURNS boolean AS $$
DECLARE
  e text := lower(trim(p_email));
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = e) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM member_invites WHERE lower(email) = e AND status = 'pending') THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM intake_responses WHERE lower(email) = e AND status = 'invited') THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM org_admin_invites WHERE lower(email) = e AND status = 'pending') THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
