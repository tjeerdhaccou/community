-- 1. Toegewezen rol bij uitnodiging
ALTER TABLE member_invites ADD COLUMN IF NOT EXISTS assigned_role TEXT DEFAULT 'guest'
  CHECK (assigned_role IN ('guest', 'aspirant', 'member', 'moderator', 'admin'));

-- 2. Update handle_new_user: gebruik assigned_role uit invite
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
  intake RECORD;
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

  -- Persoonlijke uitnodigingen koppelen met toegewezen rol
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

-- 3. Verplicht-profiel flag: project kan forceren dat profiel compleet moet zijn
ALTER TABLE projects ADD COLUMN IF NOT EXISTS require_profile_completion BOOLEAN DEFAULT true;

-- 4. Funnel stages configureerbaar per project
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_funnel_stage_check;
ALTER TABLE memberships ALTER COLUMN funnel_stage SET DEFAULT 'nieuw';

-- 5. Leden mogen eigen bestanden uploaden en verwijderen in hun dossier
CREATE POLICY "member_own_files_insert" ON member_files
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND uploaded_by = auth.uid()
    AND is_visible_to_member = true
  );

CREATE POLICY "member_own_files_delete" ON member_files
  FOR DELETE
  USING (
    profile_id = auth.uid()
    AND uploaded_by = auth.uid()
  );
