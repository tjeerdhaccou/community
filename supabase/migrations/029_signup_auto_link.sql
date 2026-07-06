-- Auto-link op signup: na het aanmaken van een auth.users row matchen we
-- het email-adres tegen pending member_invites en uitgenodigde
-- intake_responses. Voor iedere match wordt een membership met role 'guest'
-- aangemaakt en de bron-record gemarkeerd als accepted/joined.
--
-- Iedereen passeert eerst de guest-fase. Admin promoveert later handmatig
-- naar aspirant of member (na interview en betaling).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
BEGIN
  -- Bestaande profile-creatie (uit 009_profile_email.sql)
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

  -- Persoonlijke uitnodigingen koppelen
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

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
