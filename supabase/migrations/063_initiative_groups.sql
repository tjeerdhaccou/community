-- ============================================================================
-- Initiatiefgroepen: light B2C-groepen die hun eigen (onzichtbare) org krijgen
-- ============================================================================
-- Achtergrond: projects.organization_id is NOT NULL en de hele RLS leunt op
-- org-admin. In plaats van "project nu, org later koppelen" krijgt elke
-- initiatiefgroep vanaf dag 1 een eigen org met kind='personal'. Komt er later
-- een procesbegeleider bij, dan is dat een upgrade (tier free->pro of project
-- verplaatsen) i.p.v. een migratie.

-- 1. Onderscheid light-groep (personal) vs echte organisatie -----------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'organization'
  CHECK (kind IN ('personal', 'organization'));

COMMENT ON COLUMN organizations.kind IS
  'personal = onzichtbare org van één initiatiefgroep (buuur light); organization = echte org met procesbegeleider (buuur pro)';

-- 2. RPC: maak in één transactie org + project + admin-koppeling -------------
-- SECURITY DEFINER zodat platform admins de inserts kunnen doen ongeacht RLS;
-- bovenin wordt expliciet op is_platform_admin() gecontroleerd.
CREATE OR REPLACE FUNCTION create_initiative_group(
  p_group_name TEXT,
  p_slug       TEXT,
  p_admin_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id      UUID;
  v_project_id  UUID;
  v_admin_id    UUID;
  v_org_slug    TEXT;
  v_admin_linked  BOOLEAN := FALSE;
  v_admin_invited BOOLEAN := FALSE;
BEGIN
  -- Alleen platform admins mogen initiatiefgroepen aanmaken
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Alleen platform admins kunnen initiatiefgroepen aanmaken';
  END IF;

  -- Normaliseer slug en valideer formaat
  p_slug := lower(trim(p_slug));
  IF p_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'Ongeldige slug: gebruik alleen kleine letters, cijfers en koppeltekens';
  END IF;

  -- Slug-collisie checken in beide tabellen (SubdomainLookup zoekt in beide)
  IF EXISTS (SELECT 1 FROM projects WHERE slug = p_slug)
     OR EXISTS (SELECT 1 FROM organizations WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'De naam "%" is al in gebruik', p_slug;
  END IF;

  -- Interne org-slug die niet als publiek subdomain wordt gebruikt
  v_org_slug := p_slug || '-org';

  -- 2a. Light-org aanmaken
  INSERT INTO organizations (name, slug, kind, tier, status, created_by)
  VALUES (p_group_name, v_org_slug, 'personal', 'free', 'active', auth.uid())
  RETURNING id INTO v_org_id;

  -- 2b. Project aanmaken (krijgt de mooie publieke slug/subdomain)
  INSERT INTO projects (organization_id, name, slug)
  VALUES (v_org_id, p_group_name, p_slug)
  RETURNING id INTO v_project_id;

  -- 2c. Group-admin koppelen of uitnodigen
  IF p_admin_email IS NOT NULL AND trim(p_admin_email) <> '' THEN
    SELECT id INTO v_admin_id
    FROM profiles
    WHERE lower(email) = lower(trim(p_admin_email))
    LIMIT 1;

    IF v_admin_id IS NOT NULL THEN
      -- Bestaand account: meteen org-admin + project-admin
      INSERT INTO org_members (organization_id, profile_id, role)
      VALUES (v_org_id, v_admin_id, 'admin')
      ON CONFLICT (organization_id, profile_id) DO NOTHING;

      INSERT INTO memberships (profile_id, project_id, role)
      VALUES (v_admin_id, v_project_id, 'admin')
      ON CONFLICT (profile_id, project_id) DO NOTHING;

      v_admin_linked := TRUE;
    ELSE
      -- Nog geen account: pending invite, handle_new_user matcht bij signup
      INSERT INTO org_admin_invites (organization_id, email, invited_by)
      VALUES (v_org_id, lower(trim(p_admin_email)), auth.uid())
      ON CONFLICT (organization_id, email) DO NOTHING;

      v_admin_invited := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'project_id', v_project_id,
    'slug', p_slug,
    'admin_linked', v_admin_linked,
    'admin_invited', v_admin_invited
  );
END;
$$;

REVOKE ALL ON FUNCTION create_initiative_group(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_initiative_group(TEXT, TEXT, TEXT) TO authenticated;
