-- Audience-model voor posts (prikbord-items)
--   public    -> zichtbaar voor iedereen die toegang heeft tot het project (guest+)
--   members   -> zichtbaar voor aspirant+ (interne posts, default-gedrag)
--   workgroup -> zichtbaar voor aspirant+ die lid is van workgroup_id
--
-- Default is 'members' zodat bestaande posts hun huidige gedrag behouden.
-- 'workgroup' wordt in deze fase nog niet via de UI aangezet — schema is
-- klaar zodat de werkgroep-UI later zonder schema-wijziging kan landen.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'members'
    CHECK (audience IN ('public', 'members', 'workgroup'));

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS workgroup_id uuid REFERENCES workgroups(id) ON DELETE CASCADE;

ALTER TABLE posts
  ADD CONSTRAINT posts_workgroup_consistency CHECK (
    (audience = 'workgroup' AND workgroup_id IS NOT NULL)
    OR (audience <> 'workgroup' AND workgroup_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_posts_audience ON posts (project_id, audience);
CREATE INDEX IF NOT EXISTS idx_posts_workgroup ON posts (workgroup_id) WHERE workgroup_id IS NOT NULL;

-- Helper: is huidige user lid van een specifieke workgroup
CREATE OR REPLACE FUNCTION is_workgroup_member(p_workgroup_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM workgroup_members
    WHERE profile_id = auth.uid() AND workgroup_id = p_workgroup_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Vervang oude SELECT/INSERT-policies door audience-bewuste varianten
DROP POLICY IF EXISTS "Members can read posts" ON posts;
DROP POLICY IF EXISTS "Members can create posts" ON posts;

CREATE POLICY "Audience-based post read"
  ON posts FOR SELECT USING (
    is_platform_admin()
    OR (audience = 'public'    AND has_membership(project_id, 'guest'))
    OR (audience = 'members'   AND has_membership(project_id, 'aspirant'))
    OR (audience = 'workgroup' AND has_membership(project_id, 'aspirant') AND is_workgroup_member(workgroup_id))
  );

-- Insert: auteur moet ingelogd zijn en mag alleen posten in een audience
-- waar hij/zij ook leesrechten heeft. Guests zijn extra beperkt tot tag
-- 'Even voorstellen' zodat ze geen willekeurig onderwerp kunnen plaatsen.
CREATE POLICY "Audience-based post create"
  ON posts FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      is_platform_admin()
      OR (
        -- Guests: alleen public + introductie-tag
        audience = 'public'
        AND has_membership(project_id, 'guest')
        AND NOT has_membership(project_id, 'aspirant')
        AND tag = 'Even voorstellen'
      )
      OR (
        -- Aspirant+: public of members
        audience IN ('public', 'members')
        AND has_membership(project_id, 'aspirant')
      )
      OR (
        -- Aspirant+ in workgroup: workgroup-audience
        audience = 'workgroup'
        AND has_membership(project_id, 'aspirant')
        AND is_workgroup_member(workgroup_id)
      )
    )
  );

-- Bestaande "Nieuw lid"-posts hernoemen naar "Even voorstellen"
-- (constants.js wordt in dezelfde PR aangepast — een mismatch zou de tag
-- voor oude posts uit de tag-filter laten verdwijnen).
UPDATE posts SET tag = 'Even voorstellen' WHERE tag = 'Nieuw lid';
