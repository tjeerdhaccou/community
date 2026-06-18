-- Fase 3 — brug van publiek intakeformulier naar profiel.
--
-- Wanneer een uitgenodigde intake-respondent zich aanmeldt (auth.users-insert),
-- koppelt de trigger al een 'guest'-membership. Nu zetten we óók de
-- catalogus-gekoppelde antwoorden (vragen met profile_field_key) over naar het
-- profiel — FILL-EMPTY-ONLY: bestaande profielwaarden worden nooit overschreven.
--
-- De antwoorden staan in intake_responses.answers, gekeyed op question_id. We
-- bouwen daaruit een jsonb {kolomnaam: waarde} (profile_field_key == kolomnaam
-- voor profielvelden) en gebruiken jsonb_populate_record om de juiste types te
-- casten. Vrije projectvragen (zonder profile_field_key) blijven in de blob.
--
-- Behoudt alle defensiviteit en search_path van migratie 066.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
  org_inv RECORD;
  answer_json jsonb;
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

  -- Uitgenodigde intake-respondenten koppelen + antwoorden naar profiel
  BEGIN
    FOR intake IN
      SELECT id, project_id, name, phone, answers FROM intake_responses
      WHERE lower(email) = lower(new.email) AND status = 'invited'
    LOOP
      INSERT INTO memberships (profile_id, project_id, role)
      VALUES (new.id, intake.project_id, 'guest')
      ON CONFLICT (profile_id, project_id) DO NOTHING;

      -- Brug: catalogus-antwoorden → profiel (fill-empty-only)
      BEGIN
        SELECT jsonb_object_agg(q.profile_field_key, intake.answers -> (q.id::text))
          INTO answer_json
        FROM intake_questions q
        WHERE q.project_id = intake.project_id
          AND q.profile_field_key IS NOT NULL
          AND intake.answers ? (q.id::text)
          AND COALESCE(intake.answers ->> (q.id::text), '') <> '';

        UPDATE profiles p SET
          first_name            = COALESCE(p.first_name, src.first_name),
          last_name             = COALESCE(p.last_name, src.last_name),
          date_of_birth         = COALESCE(p.date_of_birth, src.date_of_birth),
          gender                = COALESCE(p.gender, src.gender),
          postal_code           = COALESCE(p.postal_code, src.postal_code),
          house_number          = COALESCE(p.house_number, src.house_number),
          street_address        = COALESCE(p.street_address, src.street_address),
          city                  = COALESCE(p.city, src.city),
          household             = COALESCE(p.household, src.household),
          partner_name          = COALESCE(p.partner_name, src.partner_name),
          partner_gender        = COALESCE(p.partner_gender, src.partner_gender),
          num_children          = COALESCE(p.num_children, src.num_children),
          children_ages         = COALESCE(p.children_ages, src.children_ages),
          current_housing_type  = COALESCE(p.current_housing_type, src.current_housing_type),
          housing_preference    = COALESCE(p.housing_preference, src.housing_preference),
          max_budget            = COALESCE(p.max_budget, src.max_budget),
          desired_rooms         = COALESCE(p.desired_rooms, src.desired_rooms),
          desired_area_m2       = COALESCE(p.desired_area_m2, src.desired_area_m2),
          parking_needed        = COALESCE(p.parking_needed, src.parking_needed),
          accessibility_needs   = COALESCE(p.accessibility_needs, src.accessibility_needs),
          housing_dream         = COALESCE(p.housing_dream, src.housing_dream),
          occupation            = COALESCE(p.occupation, src.occupation),
          employer              = COALESCE(p.employer, src.employer),
          income_indication     = COALESCE(p.income_indication, src.income_indication),
          partner_occupation    = COALESCE(p.partner_occupation, src.partner_occupation),
          motivation            = COALESCE(p.motivation, src.motivation),
          skills                = COALESCE(p.skills, src.skills),
          availability          = COALESCE(p.availability, src.availability),
          emergency_contact_name  = COALESCE(p.emergency_contact_name, src.emergency_contact_name),
          emergency_contact_phone = COALESCE(p.emergency_contact_phone, src.emergency_contact_phone),
          phone     = COALESCE(p.phone, NULLIF(trim(intake.phone), '')),
          full_name = COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(intake.name), ''))
        FROM jsonb_populate_record(NULL::profiles, COALESCE(answer_json, '{}'::jsonb)) src
        WHERE p.id = new.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: intake answer bridge failed for % — %', new.email, SQLERRM;
      END;

      UPDATE intake_responses
      SET status = 'joined', profile_id = new.id
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
