-- Eigen (custom) intake-vragen bewaren op het lidmaatschap.
--
-- Het publieke intakeformulier kan twee soorten vragen bevatten:
--   * Profielvragen (profile_field_key gezet) → landen op de profielvelden.
--   * Eigen vragen (profile_field_key NULL) → projectspecifiek; die hoorden
--     nergens thuis behalve in de losse intake_responses.answers-blob.
--
-- We bewaren de antwoorden op eigen vragen voortaan op de membership (per
-- project, zodat ze niet botsen tussen projecten) als een jsonb-array
-- [{question, answer}, ...]. Alleen zichtbaar voor beheerders (CMS-dossier).

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS custom_fields JSONB;

-- Brug uitbreiden: bij signup van een uitgenodigde intake-respondent ook de
-- eigen-vraag-antwoorden naar membership.custom_fields schrijven (fill-empty).
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

  -- Uitgenodigde intake-respondenten koppelen + antwoorden/naam/consent naar profiel
  BEGIN
    FOR intake IN
      SELECT id, project_id, name, phone, answers, terms_accepted_at, terms_version
      FROM intake_responses
      WHERE lower(email) = lower(new.email) AND status = 'invited'
    LOOP
      INSERT INTO memberships (profile_id, project_id, role)
      VALUES (new.id, intake.project_id, 'guest')
      ON CONFLICT (profile_id, project_id) DO NOTHING;

      -- Brug: catalogus-antwoorden + naam + consent -> profiel (fill-empty-only)
      BEGIN
        SELECT jsonb_object_agg(q.profile_field_key, intake.answers -> (q.id::text))
          INTO answer_json
        FROM intake_questions q
        WHERE q.project_id = intake.project_id
          AND q.profile_field_key IS NOT NULL
          AND intake.answers ? (q.id::text)
          AND COALESCE(intake.answers ->> (q.id::text), '') <> '';

        UPDATE profiles p SET
          first_name            = COALESCE(p.first_name, src.first_name,
                                    NULLIF(split_part(trim(intake.name), ' ', 1), '')),
          last_name             = COALESCE(p.last_name, src.last_name,
                                    CASE WHEN position(' ' IN trim(intake.name)) > 0
                                         THEN NULLIF(trim(substring(trim(intake.name)
                                              FROM position(' ' IN trim(intake.name)) + 1)), '')
                                         ELSE NULL END),
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
          full_name = COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(intake.name), '')),
          terms_accepted_at = COALESCE(p.terms_accepted_at, intake.terms_accepted_at),
          terms_version     = COALESCE(p.terms_version, intake.terms_version)
        FROM jsonb_populate_record(NULL::profiles, COALESCE(answer_json, '{}'::jsonb)) src
        WHERE p.id = new.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: intake answer bridge failed for % — %', new.email, SQLERRM;
      END;

      -- Eigen (custom) vragen -> membership.custom_fields (fill-empty-only)
      BEGIN
        UPDATE memberships m SET custom_fields = sub.cf
        FROM (
          SELECT jsonb_agg(
                   jsonb_build_object('question', q.question_text,
                                      'answer', intake.answers ->> (q.id::text))
                   ORDER BY q.sort_order
                 ) AS cf
          FROM intake_questions q
          WHERE q.project_id = intake.project_id
            AND q.profile_field_key IS NULL
            AND intake.answers ? (q.id::text)
            AND COALESCE(intake.answers ->> (q.id::text), '') <> ''
        ) sub
        WHERE m.profile_id = new.id
          AND m.project_id = intake.project_id
          AND m.custom_fields IS NULL
          AND sub.cf IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: custom_fields bridge failed for % — %', new.email, SQLERRM;
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
