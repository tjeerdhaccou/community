-- Optionele CTA-knop op een section (gebruikt door text-only en footer-blokken
-- in de page builder). Frontend renderde deze velden al, kolommen ontbraken.
ALTER TABLE public_sections
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS cta_btn_color text;
