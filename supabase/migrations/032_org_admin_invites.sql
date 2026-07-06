-- Org admin invites: platform admin of bestaande org admin nodigt iemand uit
-- als beheerder van een organisatie. Werkt voor mensen zonder account: na
-- signup matcht handle_new_user de pending invite en maakt een org_members
-- row aan met role 'admin'.

CREATE TABLE IF NOT EXISTS org_admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invited_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_admin_invites_email ON org_admin_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_org_admin_invites_org ON org_admin_invites (organization_id);

ALTER TABLE org_admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform en org admins kunnen invites lezen"
  ON org_admin_invites FOR SELECT USING (
    is_platform_admin() OR is_org_admin(organization_id)
  );

CREATE POLICY "Platform en org admins kunnen invites aanmaken"
  ON org_admin_invites FOR INSERT WITH CHECK (
    is_platform_admin() OR is_org_admin(organization_id)
  );

CREATE POLICY "Platform en org admins kunnen invites updaten"
  ON org_admin_invites FOR UPDATE USING (
    is_platform_admin() OR is_org_admin(organization_id)
  );

CREATE POLICY "Platform en org admins kunnen invites verwijderen"
  ON org_admin_invites FOR DELETE USING (
    is_platform_admin() OR is_org_admin(organization_id)
  );

-- Trigger uitbreiden: na signup ook pending org_admin_invites koppelen
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
  org_inv RECORD;
BEGIN
  -- Profile aanmaken / bijwerken
  INSERT INTO profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    email = EXCLUDED.email;

  -- Persoonlijke project-uitnodigingen koppelen
  FOR inv IN
    SELECT id, project_id FROM member_invites
    WHERE lower(email) = lower(new.email) AND status = 'pending'
  LOOP
    INSERT INTO memberships (profile_id, project_id, role)
    VALUES (new.id, inv.project_id, 'guest')
    ON CONFLICT (profile_id, project_id) DO NOTHING;

    UPDATE member_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;
  END LOOP;

  -- Uitgenodigde intake-respondenten koppelen
  FOR intake IN
    SELECT id, project_id FROM intake_responses
    WHERE lower(email) = lower(new.email) AND status = 'invited'
  LOOP
    INSERT INTO memberships (profile_id, project_id, role)
    VALUES (new.id, intake.project_id, 'guest')
    ON CONFLICT (profile_id, project_id) DO NOTHING;

    UPDATE intake_responses
    SET status = 'joined'
    WHERE id = intake.id;
  END LOOP;

  -- Org admin uitnodigingen koppelen
  FOR org_inv IN
    SELECT id, organization_id FROM org_admin_invites
    WHERE lower(email) = lower(new.email) AND status = 'pending'
  LOOP
    INSERT INTO org_members (organization_id, profile_id, role)
    VALUES (org_inv.organization_id, new.id, 'admin')
    ON CONFLICT DO NOTHING;

    UPDATE org_admin_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = org_inv.id;
  END LOOP;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
