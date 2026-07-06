-- Publiek intakeformulier catalogus-bewust maken.
--
-- Een intake-vraag kan nu gekoppeld zijn aan een profielveld uit de gedeelde
-- catalogus (src/lib/intakeFields.js). Is `profile_field_key` gezet, dan:
--   * rendert het formulier de canonieke dropdown + helptekst van dat veld,
--   * wordt het antwoord als canonieke slug opgeslagen,
--   * en kan het antwoord bij signup naar het profiel worden overgezet (Fase 3).
-- Is de kolom NULL, dan is het een vrije projectvraag zoals voorheen.
--
-- De waarde is een catalogus-sleutel die (voor profielvelden) gelijk is aan de
-- kolomnaam in de profiles-tabel.

ALTER TABLE intake_questions ADD COLUMN IF NOT EXISTS profile_field_key TEXT;
