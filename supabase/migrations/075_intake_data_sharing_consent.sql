-- AVG: aparte toestemming voor het delen van gegevens vastleggen.
--
-- Het publieke intakeformulier vraagt twee losse akkoorden:
--   1. delen van gegevens met initiatiefnemers/leden van het project
--   2. algemene voorwaarden + privacyverklaring  (al vastgelegd in
--      terms_accepted_at / terms_version)
--
-- Akkoord (1) werd tot nu toe alleen client-side afgedwongen (verzendknop
-- uitgeschakeld tot beide vinkjes aan staan) maar nergens opgeslagen. Voor een
-- aantoonbare AVG-grondslag leggen we het moment van toestemming vast.

ALTER TABLE intake_responses
  ADD COLUMN IF NOT EXISTS data_sharing_consent_at timestamptz;

COMMENT ON COLUMN intake_responses.data_sharing_consent_at IS
  'Moment waarop de respondent akkoord ging met het delen van gegevens met initiatiefnemers/leden (los van terms_accepted_at voor voorwaarden+privacy).';
