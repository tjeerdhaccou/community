-- Regressie-fix: migratie 051 herdefinieerde handle_new_user maar liet twee
-- eerdere fixes vallen:
--   * 035: SET search_path = public, pg_temp (anders kan de trigger vanuit de
--     auth.users-context `profiles` e.a. niet vinden → "relation does not exist")
--   * 033/035: per-stap EXCEPTION-handlers (anders breekt één falende koppel-stap
--     de hele auth.users-insert → GoTrue 500 "Database error creating new user")
--
-- Gevolg van de regressie: een NIEUWE gebruiker uitnodigen (intake → 'Uitnodigen'
-- of org-admin-invite) faalde, want generateLink maakt dan een auth.users-rij aan
-- en de trigger crasht. Bestaande accounts (magiclink, geen insert) werkten wél.
--
-- Deze migratie herstelt 051's logica (assigned_role uit member_invites,
-- org_admin_invites-koppeling) mét de defensiviteit en search_path van 035.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
  org_inv RECORD;
BEGIN
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

  -- Persoonlijke uitnodigingen koppelen met toegewezen rol
  BEGIN
    FOR inv IN
      SELECT id, project_id, assigned_role FROM member_invites
      WHERE lower(email) = lower(new.email) AND status = 'pending'
    LOOP
      INSERT INTO memberships (profile_id, project_id, role)
      VALUES (new.id, inv.project_id, COALESCE(inv.assigned_role, 'guest'))
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

  -- Org-admin-uitnodigingen koppelen
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
