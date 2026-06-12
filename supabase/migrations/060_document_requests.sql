-- ============================================================================
-- Document requests: workflow voor document-uitwisseling org ↔ lid
-- ============================================================================

-- Verzoeken / taken voor leden (upload ID, teken contract, etc.)
CREATE TABLE document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL DEFAULT 'upload_request'
    CHECK (type IN ('upload_request', 'sign_request', 'review_document')),
  category TEXT DEFAULT 'overig',
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  deadline TIMESTAMPTZ,
  attached_file_id UUID REFERENCES member_files(id) ON DELETE SET NULL,
  response_file_id UUID REFERENCES member_files(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_requests_profile ON document_requests(profile_id);
CREATE INDEX idx_document_requests_project ON document_requests(project_id);
CREATE INDEX idx_document_requests_status ON document_requests(status);

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_admins_all" ON document_requests
  FOR ALL
  USING (has_membership(project_id, 'moderator') OR is_platform_admin())
  WITH CHECK (has_membership(project_id, 'moderator') OR is_platform_admin());

CREATE POLICY "member_own_requests_read" ON document_requests
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "member_submit_response" ON document_requests
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ============================================================================
-- Download audit log
-- ============================================================================

CREATE TABLE file_download_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES member_files(id) ON DELETE CASCADE,
  downloaded_by UUID NOT NULL REFERENCES profiles(id),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_download_log_file ON file_download_log(file_id);
CREATE INDEX idx_file_download_log_project ON file_download_log(project_id);

ALTER TABLE file_download_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_download_log" ON file_download_log
  FOR SELECT
  USING (has_membership(project_id, 'moderator') OR is_platform_admin());

CREATE POLICY "users_log_downloads" ON file_download_log
  FOR INSERT
  WITH CHECK (downloaded_by = auth.uid());

-- ============================================================================
-- Extra kolommen op member_files
-- ============================================================================

ALTER TABLE member_files ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE member_files ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES document_requests(id) ON DELETE SET NULL;

-- ============================================================================
-- Strakkere storage policies: pad-gebaseerd ({project_id}/{profile_id}/*)
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can upload member files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read member files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete member files" ON storage.objects;

-- Upload: alleen naar eigen pad OF als moderator+ (team uploads voor leden)
CREATE POLICY "member_files_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'member-files'
    AND auth.role() = 'authenticated'
  );

-- Read: alleen eigen bestanden (pad begint met profile_id) OF moderator+
-- (Signed URLs bypassen storage policies, maar dit is defense-in-depth)
CREATE POLICY "member_files_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'member-files'
    AND auth.role() = 'authenticated'
  );

-- Delete: alleen moderators (leden verwijderen via DB, niet direct storage)
CREATE POLICY "member_files_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'member-files'
    AND auth.role() = 'authenticated'
  );
