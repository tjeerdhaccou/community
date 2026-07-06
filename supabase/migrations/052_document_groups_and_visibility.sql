-- ============================================================================
-- Document Groups & Visibility System
-- Adds configurable workgroup types (commissie/doelgroep), document visibility,
-- and a many-to-many link between documents and workgroups.
-- ============================================================================

-- 1. Extend workgroups with type, icon, sort_order
ALTER TABLE workgroups
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'commissie'
    CHECK (type IN ('commissie', 'doelgroep')),
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- 2. Extend documents with visibility and phase
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'members'
    CHECK (visibility IN ('public', 'members', 'groups')),
  ADD COLUMN IF NOT EXISTS phase text;

-- 3. Migrate existing category values to new schema
-- First: add new allowed values to category column
-- The old values were: contract, reglement, presentatie, handleiding, overig
-- We need to widen the check constraint, migrate data, then tighten

-- Drop old check constraint on category (if it exists)
DO $$
BEGIN
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Migrate existing category values
UPDATE documents SET category = 'juridisch' WHERE category IN ('contract', 'reglement');
UPDATE documents SET category = 'vergadering' WHERE category = 'presentatie';
UPDATE documents SET category = 'verkoop_informatie' WHERE category = 'handleiding';
-- 'overig' stays 'overig'

-- Add new check constraint with all allowed values
ALTER TABLE documents
  ADD CONSTRAINT documents_category_check
    CHECK (category IN (
      'ontwerp_visualisatie', 'juridisch', 'vergunning_technisch',
      'financieel', 'verkoop_informatie', 'vergadering', 'overig'
    ));

-- 4. Create document_groups junction table (many-to-many)
CREATE TABLE IF NOT EXISTS document_groups (
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  workgroup_id uuid REFERENCES workgroups(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (document_id, workgroup_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_groups_workgroup ON document_groups (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents (project_id, visibility);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (project_id, category);

-- 5. Enable RLS on document_groups
ALTER TABLE document_groups ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for document_groups

-- Read: anyone who can see the document can see its group links
CREATE POLICY "Document group links readable by project members"
  ON document_groups FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_id
    )
  );

-- Write: org admins and project moderators+
CREATE POLICY "Org admins and moderators can manage document groups"
  ON document_groups FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = document_id
        AND (is_org_admin(p.organization_id) OR has_membership(d.project_id, 'moderator'))
    )
  );

CREATE POLICY "Org admins and moderators can delete document groups"
  ON document_groups FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = document_id
        AND (is_org_admin(p.organization_id) OR has_membership(d.project_id, 'moderator'))
    )
  );

-- 7. Update/create RLS policies on documents table
-- First check if RLS is enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (safe to run even if they don't exist)
DROP POLICY IF EXISTS "Members can read documents" ON documents;
DROP POLICY IF EXISTS "Moderators can manage documents" ON documents;
DROP POLICY IF EXISTS "Moderators can insert documents" ON documents;
DROP POLICY IF EXISTS "Moderators can update documents" ON documents;
DROP POLICY IF EXISTS "Moderators can delete documents" ON documents;

-- SELECT: visibility-based access
CREATE POLICY "Document visibility read"
  ON documents FOR SELECT USING (
    -- Platform admin sees all
    is_platform_admin()
    -- Org admin sees all project docs in their org
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    -- Public docs: anyone with at least guest membership
    OR (visibility = 'public' AND has_membership(project_id, 'guest'))
    -- Members docs: aspirant and above
    OR (visibility = 'members' AND has_membership(project_id, 'aspirant'))
    -- Group docs: aspirant+ who is member of at least one linked group
    OR (visibility = 'groups' AND has_membership(project_id, 'aspirant')
        AND EXISTS (
          SELECT 1 FROM document_groups dg
          JOIN workgroup_members wm ON wm.workgroup_id = dg.workgroup_id
          WHERE dg.document_id = documents.id AND wm.profile_id = auth.uid()
        ))
  );

-- INSERT: org admins and project moderators+
CREATE POLICY "Org admins and moderators can create documents"
  ON documents FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'moderator')
  );

-- UPDATE: org admins and project moderators+
CREATE POLICY "Org admins and moderators can update documents"
  ON documents FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'moderator')
  );

-- DELETE: org admins and project admins
CREATE POLICY "Org admins and project admins can delete documents"
  ON documents FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND is_org_admin(p.organization_id)
    )
    OR has_membership(project_id, 'admin')
  );
