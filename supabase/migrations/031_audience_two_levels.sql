-- Events visibility consolideren naar 2 niveaus.
-- 'aspirant' vervalt; aspiranten zien dezelfde events als leden.
-- (Tjeerd's model: aspirant en lid hebben praktisch dezelfde toegang;
-- verschil is offline interview + betaling.)

UPDATE meetings SET visibility = 'members' WHERE visibility = 'aspirant';

ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_visibility_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_visibility_check
  CHECK (visibility IN ('public', 'members'));

-- Read-policy bijwerken: 'members' nu toegankelijk voor aspirant+ (i.p.v. member+)
DROP POLICY IF EXISTS "Members can read meetings" ON meetings;
CREATE POLICY "Members can read meetings"
  ON meetings FOR SELECT USING (
    is_platform_admin()
    OR (visibility = 'public'  AND has_membership(project_id, 'guest'))
    OR (visibility = 'members' AND has_membership(project_id, 'aspirant'))
  );

-- RSVP-policies blijven werken: 'aspirant'-policy in 010 dekt nog steeds
-- aspirant+ rsvp voor meetings met visibility='members' (via has_membership).
