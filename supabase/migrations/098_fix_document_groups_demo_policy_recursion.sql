-- ============================================================================
-- 098 — FIX: infinite recursion in RLS policy for relation "documents"
-- ----------------------------------------------------------------------------
-- Symptoom: elke SELECT op documents én document_groups faalde met
--   42P17 "infinite recursion detected in policy for relation \"documents\"".
-- Gevolg: geen enkel projectdocument meer zichtbaar in CMS of community-app,
-- en downloads faalden ook — de storage-policy `project_files_select` doet
-- `EXISTS (SELECT 1 FROM documents ...)` en erfde daardoor dezelfde fout,
-- dus createSignedUrl gaf niets terug.
--
-- Oorzaak: de (direct op prod aangebrachte, nooit in een migratie vastgelegde)
-- demo-policy `Demo read document_groups` leest uit `documents`:
--     EXISTS (SELECT 1 FROM documents d
--             WHERE d.id = document_groups.document_id
--               AND is_demo_project(d.project_id))
-- terwijl de SELECT-policy `Document visibility read` op `documents` in zijn
-- groups-tak juist uit `document_groups` leest. Permissive policies worden
-- allemaal ge-OR'd en dus ook allemaal gepland → documents → document_groups →
-- documents → 42P17. Dat de tweede document_groups-policy `USING (true)` is,
-- helpt niet: de recursieve policy wordt alsnog geëvalueerd.
--
-- Fix: dezelfde demo-toegang, maar via `workgroups` (heeft project_id) i.p.v.
-- via `documents`. workgroups heeft geen policy die terugverwijst naar
-- document_groups of documents, dus de cyclus is weg.
--
-- Vuistregel voor de toekomst: een policy op tabel A mag nooit uit tabel B
-- lezen als B's policies uit A lezen. Heb je zo'n check echt nodig, doe hem
-- dan in een SECURITY DEFINER-functie (die RLS omzeilt).
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Demo read document_groups" ON document_groups;

CREATE POLICY "Demo read document_groups"
  ON document_groups FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workgroups w
      WHERE w.id = document_groups.workgroup_id
        AND is_demo_project(w.project_id)
    )
  );

COMMIT;
