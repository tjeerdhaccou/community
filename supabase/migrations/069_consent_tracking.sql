-- AVG/GDPR: expliciete consent op privacyverklaring + algemene voorwaarden.
--
-- Bij het aanmaken van het profiel (de profiel-guard) vinkt het lid een
-- verplichte checkbox aan. We leggen vast WANNEER en op WELKE VERSIE van de
-- voorwaarden de toestemming is gegeven, zodat we bij een wijziging opnieuw
-- om akkoord kunnen vragen en de toestemming aantoonbaar is.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_version TEXT;
