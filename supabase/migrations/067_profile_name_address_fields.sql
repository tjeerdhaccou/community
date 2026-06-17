-- Onboarding-optimalisatie: gestructureerde naam + adres.
--
-- Tot nu toe had een profiel alleen één vrij `full_name`-veld. Voor de
-- ledenwerving willen we voornaam/achternaam apart kunnen uitvragen en het
-- adres (postcode + huisnummer) bij binnenkomst verplichten.
--
-- `full_name` blijft de canonieke weergavenaam (wordt op ~168 plekken in de
-- frontend gebruikt). De app stelt `full_name` bij opslaan samen uit
-- voornaam + achternaam, zodat alle bestaande weergaven blijven werken.
--
-- `postal_code`, `street_address` en `city` bestaan al sinds migratie 049;
-- hier voegen we alleen `house_number` toe.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS house_number TEXT;

-- Backfill: bestaande full_name splitsen op de eerste spatie.
-- Eerste woord -> voornaam, de rest -> achternaam.
UPDATE profiles
SET
  first_name = NULLIF(split_part(trim(full_name), ' ', 1), ''),
  last_name  = NULLIF(trim(substring(trim(full_name) FROM position(' ' IN trim(full_name)) + 1)), '')
WHERE full_name IS NOT NULL
  AND trim(full_name) <> ''
  AND first_name IS NULL
  AND last_name IS NULL;

-- handle_new_user uitbreiden: bij nieuwe gebruikers met een full_name in de
-- auth-metadata (bijv. Google-login) meteen first_name/last_name afleiden, zodat
-- die mensen de naam-stap van de profiel-guard kunnen overslaan.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
  org_inv RECORD;
  meta_name TEXT;
BEGIN
  meta_name := trim(coalesce(new.raw_user_meta_data->>'full_name', ''));

  BEGIN
    INSERT INTO profiles (id, full_name, first_name, last_name, avatar_url, email)
    VALUES (
      new.id,
      NULLIF(meta_name, ''),
      NULLIF(split_part(meta_name, ' ', 1), ''),
      NULLIF(trim(substring(meta_name FROM position(' ' IN meta_name) + 1)), ''),
      new.raw_user_meta_data->>'avatar_url',
      new.email
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
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
