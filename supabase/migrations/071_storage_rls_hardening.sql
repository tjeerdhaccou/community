-- ============================================================================
-- 070 — STORAGE RLS HARDENING  (BLOK 5 uit RLS-FIX-VOORSTEL.sql)
-- ----------------------------------------------------------------------------
-- Dicht twee storage-lekken in de gedeelde DB (czgsqmbejsmcjusigwhp):
--
--   5a  member-files (privé):  brede policies member_files_read/_upload/_delete
--       (alleen auth.role()='authenticated') lieten ELKE ingelogde gebruiker
--       ALLE ledendocumenten listen/lezen/verwijderen — over tenants heen.
--       Fix: brede policies droppen; scope op eigenaar (= laatste pad-segment,
--       de profile_id) OF project-admin/moderator (via member_files-join) OF
--       platform-admin.
--
--   5b  project-files: was een PUBLIEKE bucket → bestanden met de URL door
--       iedereen te downloaden, ongeacht documents.visibility.
--       Fix: bucket op private; getPublicUrl → createSignedUrl in beide apps;
--       SELECT-policy hergebruikt de RLS van documents/meeting_files/
--       update_attachments/update_files via een file_path-match.
--
-- ⚠️ APP-COÖRDINATIE: deze migratie hoort samen met de app-deploys die
--    storage-paden i.p.v. publieke URL's opslaan en signed URLs genereren
--    (community + buuur-admin). Bestaande publieke project-files-links breken
--    zodra de bucket private wordt; daarom samen uitrollen.
--
-- Geverifieerd per rol (anon / authenticated / org-admin / platform-admin) met
-- SET LOCAL ROLE + request.jwt.claims vóór toepassing (dry-run, alles geslaagd).
--
-- Niet in dit bestand (kan niet via SQL — storage.protect_delete-trigger):
--   verwijderen van de 10 platte test-objecten in bucket member-files.
--   Dit is via de Storage API gedaan (service_role).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 5a — member-files policies
-- ---------------------------------------------------------------------------
-- Brede, ongescopte policies (de kwetsbaarheid):
DROP POLICY IF EXISTS "member_files_read"   ON storage.objects;
DROP POLICY IF EXISTS "member_files_upload" ON storage.objects;
DROP POLICY IF EXISTS "member_files_delete" ON storage.objects;
-- Oude admin-policies (vervangen door tenant-gescopte varianten hieronder):
DROP POLICY IF EXISTS "admins_read_member_files"   ON storage.objects;
DROP POLICY IF EXISTS "admins_upload_member_files" ON storage.objects;
DROP POLICY IF EXISTS "admins_delete_member_files" ON storage.objects;

-- Eigenaar = laatste mapsegment van het pad (de profile_id). Werkt voor zowel
-- het community-pad  `${projectId}/${profileId}/<bestand>`  als het CMS-pad
-- `${orgId}/${projectId}/${profileId}/<bestand>`.
CREATE POLICY "member_files_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'member-files' AND (
    is_platform_admin()
    OR auth.uid()::text = (storage.foldername(name))[array_length(storage.foldername(name), 1)]
    OR EXISTS (
      SELECT 1 FROM member_files mf
      WHERE mf.file_path = storage.objects.name
        AND has_membership(mf.project_id, 'moderator')
    )
  )
);

-- INSERT: er bestaat nog geen member_files-rij op uploadmoment, dus scope op
-- eigen map (member self-upload) OF admin/moderator (van enig project) OF
-- platform-admin. Een rij aanmaken in een ander tenant is alsnog geblokkeerd
-- door de RLS op de member_files-tabel zelf.
CREATE POLICY "member_files_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'member-files' AND (
    is_platform_admin()
    OR auth.uid()::text = (storage.foldername(name))[array_length(storage.foldername(name), 1)]
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.profile_id = auth.uid() AND m.role IN ('admin', 'moderator')
    )
  )
);

CREATE POLICY "member_files_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'member-files' AND (
    is_platform_admin()
    OR auth.uid()::text = (storage.foldername(name))[array_length(storage.foldername(name), 1)]
    OR EXISTS (
      SELECT 1 FROM member_files mf
      WHERE mf.file_path = storage.objects.name
        AND has_membership(mf.project_id, 'moderator')
    )
  )
);

-- Opruimen test-data: de platte (mappenloze) test-uploads. Bijbehorende
-- storage-objecten worden via de Storage API verwijderd. document_requests die
-- ernaar verwijzen krijgen response_file_id = NULL (FK ON DELETE SET NULL);
-- file_download_log cascadeert. Alles betreft het seed-project (…b000…).
DELETE FROM member_files WHERE file_path NOT LIKE '%/%';

-- ---------------------------------------------------------------------------
-- 5b — project-files: file_path normaliseren + bucket private + scoped SELECT
-- ---------------------------------------------------------------------------
-- Bestaande rijen sloegen de volledige publieke URL op; normaliseer naar het
-- kale (gedecodeerde) storage-pad, zodat de policy een exacte match kan doen
-- en de nieuwe app-code (signed URLs) het pad direct kan ondertekenen.
UPDATE documents   SET file_path = 'documents/e50aeaf3-2f14-4a9a-b689-ea2c7a27c67e/1780401493294-20260528_Workshop foto''s (MarCom).zip' WHERE id = '76d13f9a-2284-4a2a-92fd-20b9ddc1e9bc';
UPDATE documents   SET file_path = 'documents/e50aeaf3-2f14-4a9a-b689-ea2c7a27c67e/1780920699385-1000125241.jpg'                        WHERE id = 'cb18cb8d-9799-4905-931f-06ea5e60084c';
UPDATE documents   SET file_path = 'documents/e50aeaf3-2f14-4a9a-b689-ea2c7a27c67e/1781124302966-crowdbuilding_logo_investedblue.jpg'   WHERE id = 'be45b3bf-3be6-45aa-98d4-78cc01cd755b';
UPDATE documents   SET file_path = '1774541093862-tylwh76gfcj.pdf'                                                                      WHERE id = '18753559-9b8a-43ec-91a9-dbadd4585c40';
UPDATE documents   SET file_path = 'documents/e50aeaf3-2f14-4a9a-b689-ea2c7a27c67e/1781123909852-crowdbuilding_logo_finepink.pdf'       WHERE id = '3a812da0-07b2-499a-9abe-a8cc51535a56';
UPDATE documents   SET file_path = '1774541093862-tylwh76gfcj.pdf'                                                                      WHERE id = '2756c091-d052-472e-82c2-d1033919077f';
UPDATE update_files SET file_path = '1774541093862-tylwh76gfcj.pdf'                                                                     WHERE id = '71ea7c0d-b830-4b79-984c-31f03dcbe11b';

UPDATE storage.buckets SET public = false WHERE id = 'project-files';

DROP POLICY IF EXISTS "Public read access for project files" ON storage.objects;

-- SELECT mag alleen als er een verwijzende rij bestaat die de huidige gebruiker
-- volgens de RLS van die tabel mág zien (visibility/membership/groups), of als
-- de gebruiker platform-admin is.
CREATE POLICY "project_files_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'project-files' AND (
    is_platform_admin()
    OR EXISTS (SELECT 1 FROM documents d          WHERE d.file_path  = storage.objects.name)
    OR EXISTS (SELECT 1 FROM meeting_files mf      WHERE mf.file_path = storage.objects.name)
    OR EXISTS (SELECT 1 FROM update_attachments ua WHERE ua.file_path = storage.objects.name)
    OR EXISTS (SELECT 1 FROM update_files uf       WHERE uf.file_path = storage.objects.name)
  )
);

COMMIT;
