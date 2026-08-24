-- ============================================================================
-- Demo-modus: één project waar mogelijke klanten zonder account kunnen
-- rondkijken (read-only). Zie src/lib/demo.js + SubdomainLookup.
--
-- Aanpak:
--   * `projects.is_demo` markeert het demoproject (zet je aan op de gewenste rij).
--   * Een anonieme Supabase-sessie (signInAnonymously) mag ALLE content van een
--     is_demo-project LEZEN via de policies hieronder.
--   * Er komen BEWUST géén write-policies bij. Een anonieme bezoeker heeft geen
--     membership, dus alle bestaande has_membership()-write-policies blijven
--     weigeren. RLS is daarmee de harde read-only-garantie; de UI-afscherming
--     (readOnly + "maak account"-prompt) is puur voor de nette beleving.
--
-- Policies zijn strak gescoped op is_demo = true, dus geen enkel echt project
-- lekt. Ze staan op PUBLIC (anon + authenticated) net als de bestaande
-- publieke-leespolicies (migratie 017/080).
-- ============================================================================

-- 1. Vlag op projecten
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2. Helper — leesbaar en herbruikbaar in alle child-policies
CREATE OR REPLACE FUNCTION is_demo_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p WHERE p.id = p_project_id AND p.is_demo = true
  );
$$;

-- 3. Het project zelf — anon moet de rij kunnen lezen (SubdomainLookup) zodat
--    de demo herkend wordt en de anonieme sessie gestart kan worden.
DROP POLICY IF EXISTS "Anyone can read demo projects" ON projects;
CREATE POLICY "Anyone can read demo projects"
  ON projects FOR SELECT USING (is_demo = true AND slug IS NOT NULL);

-- ----------------------------------------------------------------------------
-- Helper-macro's als plain DROP+CREATE. CREATE POLICY IF NOT EXISTS bestaat
-- niet in Postgres, dus we droppen eerst idempotent.
-- ----------------------------------------------------------------------------

-- 4. Direct aan het project gekoppeld (project_id-kolom)
DROP POLICY IF EXISTS "Demo read memberships" ON memberships;
CREATE POLICY "Demo read memberships"
  ON memberships FOR SELECT USING (is_demo_project(project_id));

DROP POLICY IF EXISTS "Demo read milestones" ON milestones;
CREATE POLICY "Demo read milestones"
  ON milestones FOR SELECT USING (is_demo_project(project_id));

DROP POLICY IF EXISTS "Demo read updates" ON updates;
CREATE POLICY "Demo read updates"
  ON updates FOR SELECT USING (is_demo_project(project_id));

DROP POLICY IF EXISTS "Demo read posts" ON posts;
CREATE POLICY "Demo read posts"
  ON posts FOR SELECT USING (is_demo_project(project_id));

DROP POLICY IF EXISTS "Demo read meetings" ON meetings;
CREATE POLICY "Demo read meetings"
  ON meetings FOR SELECT USING (is_demo_project(project_id));

DROP POLICY IF EXISTS "Demo read documents" ON documents;
CREATE POLICY "Demo read documents"
  ON documents FOR SELECT USING (is_demo_project(project_id));

DROP POLICY IF EXISTS "Demo read workgroups" ON workgroups;
CREATE POLICY "Demo read workgroups"
  ON workgroups FOR SELECT USING (is_demo_project(project_id));

-- 5. Profielen van demo-leden (auteurs van posts/updates, ledenlijst, avatars)
DROP POLICY IF EXISTS "Demo read profiles" ON profiles;
CREATE POLICY "Demo read profiles"
  ON profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN projects p ON p.id = m.project_id
      WHERE m.profile_id = profiles.id AND p.is_demo = true
    )
  );

-- 6. Post-interacties (via posts.project_id)
DROP POLICY IF EXISTS "Demo read comments" ON comments;
CREATE POLICY "Demo read comments"
  ON comments FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND is_demo_project(p.project_id))
  );

DROP POLICY IF EXISTS "Demo read post_reactions" ON post_reactions;
CREATE POLICY "Demo read post_reactions"
  ON post_reactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND is_demo_project(p.project_id))
  );

DROP POLICY IF EXISTS "Demo read post_likes" ON post_likes;
CREATE POLICY "Demo read post_likes"
  ON post_likes FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND is_demo_project(p.project_id))
  );

DROP POLICY IF EXISTS "Demo read post_follows" ON post_follows;
CREATE POLICY "Demo read post_follows"
  ON post_follows FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND is_demo_project(p.project_id))
  );

DROP POLICY IF EXISTS "Demo read poll_options" ON poll_options;
CREATE POLICY "Demo read poll_options"
  ON poll_options FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id AND is_demo_project(p.project_id))
  );

DROP POLICY IF EXISTS "Demo read poll_votes" ON poll_votes;
CREATE POLICY "Demo read poll_votes"
  ON poll_votes FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM poll_options o
      JOIN posts p ON p.id = o.post_id
      WHERE o.id = option_id AND is_demo_project(p.project_id)
    )
  );

-- 7. Update-interacties (via updates.project_id)
DROP POLICY IF EXISTS "Demo read update_reactions" ON update_reactions;
CREATE POLICY "Demo read update_reactions"
  ON update_reactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM updates u WHERE u.id = update_id AND is_demo_project(u.project_id))
  );

DROP POLICY IF EXISTS "Demo read update_comments" ON update_comments;
CREATE POLICY "Demo read update_comments"
  ON update_comments FOR SELECT USING (
    EXISTS (SELECT 1 FROM updates u WHERE u.id = update_id AND is_demo_project(u.project_id))
  );

DROP POLICY IF EXISTS "Demo read update_attachments" ON update_attachments;
CREATE POLICY "Demo read update_attachments"
  ON update_attachments FOR SELECT USING (
    EXISTS (SELECT 1 FROM updates u WHERE u.id = update_id AND is_demo_project(u.project_id))
  );

-- 8. Event-interacties (via meetings.project_id)
DROP POLICY IF EXISTS "Demo read event_rsvps" ON event_rsvps;
CREATE POLICY "Demo read event_rsvps"
  ON event_rsvps FOR SELECT USING (
    EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND is_demo_project(m.project_id))
  );

DROP POLICY IF EXISTS "Demo read decisions" ON decisions;
CREATE POLICY "Demo read decisions"
  ON decisions FOR SELECT USING (
    EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND is_demo_project(m.project_id))
  );

-- 9. Werkgroep-leden (via workgroups.project_id)
DROP POLICY IF EXISTS "Demo read workgroup_members" ON workgroup_members;
CREATE POLICY "Demo read workgroup_members"
  ON workgroup_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM workgroups w WHERE w.id = workgroup_id AND is_demo_project(w.project_id))
  );

-- 10. Document-groepen (via workgroups.project_id)
--     LET OP: deze policy mag NIET uit `documents` lezen. De SELECT-policy op
--     documents leest namelijk uit document_groups, en permissive policies
--     worden allemaal ge-OR'd en dus allemaal gepland: documents →
--     document_groups → documents = 42P17 infinite recursion. Dat heeft in
--     augustus alle projectdocumenten onzichtbaar gemaakt en ook downloads
--     gebroken (de storage-policy doet EXISTS op documents). Zie migratie 098,
--     die deze policy op productie al naar de versie hieronder heeft gezet.
DROP POLICY IF EXISTS "Demo read document_groups" ON document_groups;
CREATE POLICY "Demo read document_groups"
  ON document_groups FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workgroups w
      WHERE w.id = document_groups.workgroup_id
        AND is_demo_project(w.project_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 11. Tabellen waarvan de exacte koppeling per omgeving kan verschillen:
--     defensief opzetten zodat de migratie niet breekt als een tabel/kolom
--     afwijkt of ontbreekt.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- roadmap_phases (project_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'roadmap_phases' AND column_name = 'project_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Demo read roadmap_phases" ON roadmap_phases';
    EXECUTE 'CREATE POLICY "Demo read roadmap_phases" ON roadmap_phases
      FOR SELECT USING (is_demo_project(project_id))';
  END IF;

  -- roadmap_items (phase_id -> roadmap_phases.project_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'roadmap_items' AND column_name = 'phase_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Demo read roadmap_items" ON roadmap_items';
    EXECUTE 'CREATE POLICY "Demo read roadmap_items" ON roadmap_items
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM roadmap_phases rp
        WHERE rp.id = roadmap_items.phase_id AND is_demo_project(rp.project_id)))';
  END IF;

  -- meeting_files (meeting_id -> meetings.project_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'meeting_files' AND column_name = 'meeting_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Demo read meeting_files" ON meeting_files';
    EXECUTE 'CREATE POLICY "Demo read meeting_files" ON meeting_files
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = meeting_files.meeting_id AND is_demo_project(m.project_id)))';
  END IF;

  -- agenda_items (meeting_id -> meetings.project_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'agenda_items' AND column_name = 'meeting_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Demo read agenda_items" ON agenda_items';
    EXECUTE 'CREATE POLICY "Demo read agenda_items" ON agenda_items
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = agenda_items.meeting_id AND is_demo_project(m.project_id)))';
  END IF;

  -- action_items (meeting_id -> meetings.project_id)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'action_items' AND column_name = 'meeting_id') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Demo read action_items" ON action_items';
    EXECUTE 'CREATE POLICY "Demo read action_items" ON action_items
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM meetings m
        WHERE m.id = action_items.meeting_id AND is_demo_project(m.project_id)))';
  END IF;
END $$;

-- ============================================================================
-- 12. Opruimen van anonieme demo-sessies. Elke bezoeker maakt een wegwerp
--     auth.users-rij (is_anonymous = true). Ruim rijen ouder dan 24u op.
--     Draait via pg_cron als de extensie beschikbaar is; anders is de functie
--     handmatig/aan te roepen via een edge function of los SQL-cron.
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_anonymous_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, auth
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH gone AS (
    DELETE FROM auth.users
    WHERE is_anonymous = true
      AND created_at < now() - interval '24 hours'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM gone;
  RETURN deleted_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-anonymous-demo-users')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-demo-users');
    PERFORM cron.schedule(
      'cleanup-anonymous-demo-users',
      '17 * * * *',                       -- ieder uur op :17
      $cron$ SELECT public.cleanup_anonymous_users(); $cron$
    );
  END IF;
END $$;
