-- ============================================================================
-- Update attachments (PDF, DOC, Excel, etc. attached to project-news updates)
--
-- Separate from `update_files` (which is FK'd to professional_updates).
-- ============================================================================

CREATE TABLE update_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID REFERENCES updates(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_update_attachments_update_id ON update_attachments(update_id);

ALTER TABLE update_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone who can see the parent update can see its attachments.
-- Mirrors the SELECT-policy on the `updates` table.
CREATE POLICY "Members can read update attachments"
  ON update_attachments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM updates u
      WHERE u.id = update_attachments.update_id
      AND (
        u.is_public
        OR has_membership(u.project_id, 'guest')
      )
    )
  );

-- INSERT: the author of the update, or a moderator on the project.
CREATE POLICY "Update authors and moderators can add attachments"
  ON update_attachments FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM updates u
      WHERE u.id = update_attachments.update_id
      AND (
        u.author_id = auth.uid()
        OR has_membership(u.project_id, 'moderator')
      )
    )
  );

-- DELETE: the author of the update, the uploader of the attachment, or an admin.
CREATE POLICY "Authors and admins can delete update attachments"
  ON update_attachments FOR DELETE USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM updates u
      WHERE u.id = update_attachments.update_id
      AND (
        u.author_id = auth.uid()
        OR has_membership(u.project_id, 'admin')
      )
    )
  );
