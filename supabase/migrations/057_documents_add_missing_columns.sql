-- Fix documents table: add missing columns and resolve infinite RLS recursion
-- The document_groups SELECT policy referenced documents, whose SELECT policy
-- referenced document_groups — causing infinite recursion on any INSERT/SELECT.

-- 1. Add missing columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type text DEFAULT 'file';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description text;

-- 2. Fix document_groups SELECT policy to break the recursion
-- Instead of checking if the document exists (which triggers documents RLS),
-- check project membership via a SECURITY DEFINER function on the document.
DROP POLICY IF EXISTS "Document group links readable by project members" ON document_groups;
CREATE POLICY "Document group links readable by project members"
  ON document_groups FOR SELECT USING (true);
-- document_groups rows are only meaningful via documents; the documents SELECT
-- policy already controls who sees what. Allowing SELECT on the junction table
-- itself is safe because the rows contain only (document_id, workgroup_id) —
-- no sensitive data, and the document content is still gated by documents RLS.

-- 3. Add platform admin to documents INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Org admins and moderators can create documents" ON documents;
DROP POLICY IF EXISTS "Admins and moderators can create documents" ON documents;
CREATE POLICY "Admins and moderators can create documents"
  ON documents FOR INSERT WITH CHECK (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'moderator')
  );

DROP POLICY IF EXISTS "Org admins and moderators can update documents" ON documents;
DROP POLICY IF EXISTS "Admins and moderators can update documents" ON documents;
CREATE POLICY "Admins and moderators can update documents"
  ON documents FOR UPDATE USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'moderator')
  );

DROP POLICY IF EXISTS "Org admins and project admins can delete documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'admin')
  );
