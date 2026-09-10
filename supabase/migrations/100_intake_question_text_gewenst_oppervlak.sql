-- Vraagtekst bijwerken na migratie 099: gewenst oppervlak wordt als bandbreedte
-- uitgevraagd, dus de "(m²)" in de vraag klopt niet meer — de eenheid zit nu in
-- de antwoordopties zelf ("Tot 50 m²", "50 tot 75 m²", ...).
--
-- Alleen vragen die nog de oude standaardtekst hebben: een project dat zelf een
-- eigen formulering heeft ingevuld houdt die.

UPDATE intake_questions
SET question_text = 'Gewenst oppervlak'
WHERE profile_field_key = 'desired_area_m2'
  AND question_text = 'Gewenst oppervlak (m²)';
