-- 079_document_share_codes.sql
-- Give every document a short, stable, unguessable share code so it can be
-- shared as a clean URL (buuur.nl/d/<code>). The /api/d/[code] redirect resolves
-- the code to a fresh signed URL on every click, so shared links never expire
-- for the recipient and never expose the raw Supabase storage URL.

-- Random 8-char code from a url-safe alphabet. Uses core random() (no pgcrypto).
CREATE OR REPLACE FUNCTION gen_share_code() RETURNS text AS $$
  SELECT string_agg(
    substr('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
           floor(random() * 62)::int + 1, 1), '')
  FROM generate_series(1, 8)
$$ LANGUAGE sql VOLATILE;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS share_code text;

-- Backfill existing rows
UPDATE documents SET share_code = gen_share_code() WHERE share_code IS NULL;

-- Auto-assign on insert, regardless of which code path creates the document
ALTER TABLE documents ALTER COLUMN share_code SET DEFAULT gen_share_code();
ALTER TABLE documents ALTER COLUMN share_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_share_code ON documents (share_code);
