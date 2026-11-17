-- 127: inlogcode alleen voor adressen die bij de pagina horen
--
-- Deze drie functies staan al live in de database (project "Community"), maar
-- zaten nog in geen enkel migratiebestand. De definities hieronder zijn
-- letterlijk opgehaald met pg_get_functiondef; deze migratie verandert dus
-- niets aan de live database, ze legt alleen vast wat er staat.
--
-- check_invited_email: t.o.v. 040 één wijziging. Een subdomein dat geen
--   project of organisatie is, geeft nooit een code (voorheen viel het door
--   naar de controle van het hoofddomein, waar elk bestaand account mag).
--   Op buuur.nl zelf (geen subdomein) mag elk bestaand account inloggen; dat
--   is bewust zo gelaten.
-- subdomain_exists: of een slug een project of organisatie is, zonder iets
--   over dat project prijs te geven. Aanroepbaar door anon, zodat
--   SubdomainLookup een onbekend subdomein kan herkennen terwijl RLS de
--   projecten en organisaties voor anonieme bezoekers verbergt.
-- check_admin_login_email: de inlogcontrole van buuur-admin (beheerder,
--   platformbeheerder of openstaande beheerdersuitnodiging).
--
-- Niet hier: een "Before User Created"-hook die accounts zonder uitnodiging
-- weigert. Die is geprobeerd en teruggedraaid, want hij blokkeert /start-groep
-- en de anonieme klikdemo.

CREATE OR REPLACE FUNCTION public.check_invited_email(p_email text, p_subdomain_slug text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  e text := lower(trim(p_email));
  org_id_v uuid;
  project_id_v uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles WHERE lower(email) = e AND is_platform_admin = true
  ) THEN RETURN true; END IF;

  IF p_subdomain_slug IS NOT NULL THEN
    SELECT id INTO org_id_v FROM organizations WHERE slug = p_subdomain_slug;
    SELECT id INTO project_id_v FROM projects WHERE slug = p_subdomain_slug;

    -- Subdomein dat geen project of organisatie is: nooit een code
    IF org_id_v IS NULL AND project_id_v IS NULL THEN
      RETURN false;
    END IF;
  END IF;

  IF org_id_v IS NOT NULL THEN
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
    IF EXISTS (
      SELECT 1 FROM org_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN projects pr ON pr.organization_id = om.organization_id
      WHERE lower(p.email) = e AND pr.id = project_id_v
        AND (om.project_ids IS NULL OR pr.id = ANY (om.project_ids))
    ) THEN RETURN true; END IF;
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = e) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM member_invites WHERE lower(email) = e AND status = 'pending') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM intake_responses WHERE lower(email) = e AND status = 'invited') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM org_admin_invites WHERE lower(email) = e AND status = 'pending') THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.subdomain_exists(p_slug text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM projects WHERE slug = p_slug)
    OR EXISTS (SELECT 1 FROM organizations WHERE slug = p_slug);
$function$;

CREATE OR REPLACE FUNCTION public.check_admin_login_email(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM profiles
      WHERE lower(email) = lower(trim(p_email)) AND is_platform_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM org_members om
      JOIN profiles p ON p.id = om.profile_id
      WHERE lower(p.email) = lower(trim(p_email)) AND om.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM org_admin_invites
      WHERE lower(email) = lower(trim(p_email)) AND status = 'pending'
    );
$function$;

-- Alle drie worden vóór het inloggen aangeroepen, dus anon moet ze kunnen
-- uitvoeren (zo staat het ook live).
GRANT EXECUTE ON FUNCTION public.check_invited_email(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subdomain_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_login_email(text) TO anon, authenticated;
