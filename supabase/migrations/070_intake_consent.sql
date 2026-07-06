-- AVG/GDPR: expliciete consent op het publieke intakeformulier.
--
-- Tot nu toe vinkte een aanmelder alleen aan dat zijn gegevens gedeeld mochten
-- worden met de initiatiefnemers, maar gaf hij GEEN akkoord op de
-- privacyverklaring en algemene voorwaarden — en we legden nergens vast wanneer
-- en op welke versie van de voorwaarden de toestemming gegeven werd.
--
-- Net als bij de profiel-guard (zie 069_consent_tracking) leggen we nu vast
-- WANNEER en op WELKE VERSIE de toestemming is gegeven, zodat de toestemming
-- aantoonbaar is en we bij een wijziging opnieuw om akkoord kunnen vragen.

ALTER TABLE intake_responses ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE intake_responses ADD COLUMN IF NOT EXISTS terms_version TEXT;
