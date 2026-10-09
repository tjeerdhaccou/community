-- Echte handtekening (getekend of foto) + invulregels op de PDF bij tekenen.
--
-- * signed_signature_path: PNG van de krabbel van het lid, naast de getekende
--   PDF in de bucket (<org>/<request>/signed-<signer>.png). Nodig omdat de
--   tegentekening (edge fn countersign-request) de lid-blokken opnieuw tekent
--   uit de audit-snapshot — zonder de PNG zou daar een getypte naam komen.
-- * signed_annotations: tekstregels die het lid zelf op de PDF heeft gezet
--   (bv. NAW op de stippellijnen), [{page, x, y, text, size}] genormaliseerd.
-- * countersign_signature_path: de krabbel namens de organisatie, per verzoek
--   (snapshot) en als standaard op de organisatie (<org>/countersign-signature.png).
-- Toegepast op prod 2026-10-09.

ALTER TABLE public.signature_request_signers
  ADD COLUMN IF NOT EXISTS signed_signature_path text,
  ADD COLUMN IF NOT EXISTS signed_annotations jsonb;

ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS countersign_signature_path text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS countersign_signature_path text;

-- Signer mag naast signed-<id>.pdf ook signed-<id>.png schrijven (zelfde
-- voorwaarden: eigen rij, nog niet getekend).
DROP POLICY IF EXISTS signatures_signer_upload_self ON storage.objects;
CREATE POLICY signatures_signer_upload_self ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND storage.filename(name) LIKE 'signed-%'
    AND EXISTS (
      SELECT 1 FROM public.signature_request_signers s
      WHERE s.request_id::text = (storage.foldername(name))[2]
        AND s.id::text = SUBSTRING(storage.filename(name) FROM '^signed-(.+)\.(?:pdf|png)$')
        AND s.profile_id = auth.uid()
        AND s.status IN ('pending', 'viewed')
    )
  );

DROP POLICY IF EXISTS signatures_signer_update_self ON storage.objects;
CREATE POLICY signatures_signer_update_self ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'signatures'
    AND storage.filename(name) LIKE 'signed-%'
    AND EXISTS (
      SELECT 1 FROM public.signature_request_signers s
      WHERE s.request_id::text = (storage.foldername(name))[2]
        AND s.id::text = SUBSTRING(storage.filename(name) FROM '^signed-(.+)\.(?:pdf|png)$')
        AND s.profile_id = auth.uid()
        AND s.status IN ('pending', 'viewed')
    )
  )
  WITH CHECK (
    bucket_id = 'signatures'
    AND storage.filename(name) LIKE 'signed-%'
    AND EXISTS (
      SELECT 1 FROM public.signature_request_signers s
      WHERE s.request_id::text = (storage.foldername(name))[2]
        AND s.id::text = SUBSTRING(storage.filename(name) FROM '^signed-(.+)\.(?:pdf|png)$')
        AND s.profile_id = auth.uid()
        AND s.status IN ('pending', 'viewed')
    )
  );
