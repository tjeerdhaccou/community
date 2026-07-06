-- Defensieve versie van handle_new_user: elke koppel-stap heeft een eigen
-- EXCEPTION-block zodat de signup zelf nooit faalt als een sub-insert mis
-- gaat. Bij een fout loggen we via RAISE WARNING naar de Postgres logs,
-- zodat we de echte SQL-error kunnen achterhalen zonder de hele auth-flow
-- te breken.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
  org_inv RECORD;
BEGIN
  -- Profile aanmaken / bijwerken
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profile insert failed for % — %', new.email, SQLERRM;
  END;

  -- Persoonlijke project-uitnodigingen koppelen
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: member_invites link failed for % — %', new.email, SQLERRM;
  END;

  -- Uitgenodigde intake-respondenten koppelen
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: intake_responses link failed for % — %', new.email, SQLERRM;
  END;

  -- Org admin uitnodigingen koppelen
  BEGIN
    FOR org_inv IN
      SELECT id, organization_id FROM org_admin_invites
      WHERE lower(email) = lower(new.email) AND status = 'pending'
    LOOP
      INSERT INTO org_members (organization_id, profile_id, role)
      VALUES (org_inv.organization_id, new.id, 'admin')
      ON CONFLICT (organization_id, profile_id) DO NOTHING;

      UPDATE org_admin_invites
      SET status = 'accepted', accepted_at = now()
      WHERE id = org_inv.id;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: org_admin_invites link failed for % — %', new.email, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
