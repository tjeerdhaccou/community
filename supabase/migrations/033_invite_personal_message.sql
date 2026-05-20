-- Persoonlijk bericht per uitnodiging — los van de generieke project/org
-- intro-tekst. Wordt in de mail als citaat boven de intro getoond.
-- Opslaan zodat resend van een invite hetzelfde bericht stuurt.

ALTER TABLE member_invites
  ADD COLUMN IF NOT EXISTS personal_message text;
