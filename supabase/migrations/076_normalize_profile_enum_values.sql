-- Normaliseer bestaande profielwaarden naar de canonieke slugs uit de gedeelde
-- veldcatalogus (src/lib/intakeFields.js ↔ buuur-admin/src/lib/intake-fields.ts).
--
-- Achtergrond: het lid-formulier sloeg voorheen de leesbare LABELS op ('Man',
-- 'Huur', vrije tekst voor huishouden), terwijl de CMS de canonieke SLUGS
-- gebruikt ('man', 'koop', 'alleenstaand'). Daardoor verschenen ingevulde
-- dossiers leeg in de CMS. Vanaf nu schrijft elk formulier de slug weg; deze
-- migratie trekt de reeds opgeslagen data eenmalig recht.
--
-- Uitgangspunten:
--   * Alleen eenduidige waarden worden gemapt; al-correcte slugs blijven staan.
--   * Niet-mapbare vrije tekst laten we ongemoeid (geen dataverlies).
--   * Het oude grove 'Huur' bij huidige woonsituatie is ambigu (sociaal /
--     midden / vrij) → op NULL gezet zodat het opnieuw gekozen wordt.

-- Geslacht (lid + partner) ------------------------------------------------
UPDATE profiles SET gender = CASE lower(trim(gender))
    WHEN 'man'                 THEN 'man'
    WHEN 'vrouw'               THEN 'vrouw'
    WHEN 'anders'              THEN 'anders'
    WHEN 'zeg ik liever niet'  THEN 'zeg-ik-liever-niet'
    WHEN 'zeg-ik-liever-niet'  THEN 'zeg-ik-liever-niet'
    ELSE gender
  END
WHERE gender IS NOT NULL AND trim(gender) <> '';

UPDATE profiles SET partner_gender = CASE lower(trim(partner_gender))
    WHEN 'man'                 THEN 'man'
    WHEN 'vrouw'               THEN 'vrouw'
    WHEN 'anders'              THEN 'anders'
    WHEN 'zeg ik liever niet'  THEN 'zeg-ik-liever-niet'
    WHEN 'zeg-ik-liever-niet'  THEN 'zeg-ik-liever-niet'
    ELSE partner_gender
  END
WHERE partner_gender IS NOT NULL AND trim(partner_gender) <> '';

-- Huishoudsamenstelling ---------------------------------------------------
-- Alleen exacte single-word matches; vrije tekst ('Stel met 2 kinderen')
-- blijft staan en kan handmatig of door het lid opnieuw gekozen worden.
UPDATE profiles SET household = lower(trim(household))
WHERE lower(trim(household)) IN
  ('alleenstaand', 'stel', 'gezin', 'eenoudergezin', 'samenwonend', 'anders');

-- Huidige woonsituatie ----------------------------------------------------
UPDATE profiles SET current_housing_type = CASE lower(trim(current_housing_type))
    WHEN 'koop'   THEN 'koop'
    WHEN 'anders' THEN 'anders'
    WHEN 'huur'   THEN NULL   -- ambigu (sociaal/midden/vrij): opnieuw laten kiezen
    ELSE current_housing_type
  END
WHERE current_housing_type IS NOT NULL AND trim(current_housing_type) <> '';

-- Woonvoorkeur ------------------------------------------------------------
UPDATE profiles SET housing_preference = lower(trim(housing_preference))
WHERE lower(trim(housing_preference)) IN ('koop', 'huur', 'flexibel');

-- Inkomensindicatie was vrije tekst zonder vaste set en wordt niet
-- automatisch gemapt; nieuwe invoer gebruikt de canonieke brackets.
