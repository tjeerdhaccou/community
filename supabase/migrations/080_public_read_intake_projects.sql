-- ============================================================================
-- Publieke leesrechten op projecten met een actief intake-formulier.
--
-- Reden: SubdomainLookup en IntakeForm queryen `projects` met de anon-key om
-- het formulier te tonen op vlinderhaven.buuur.nl/intake. Zonder deze policy
-- blokkeert RLS de read (project is niet is_public), valt SubdomainLookup
-- terug op <Login /> en geeft IntakeForm een 406 op .single().
-- ============================================================================

CREATE POLICY "Anyone can read intake-enabled projects"
  ON projects FOR SELECT USING (intake_enabled = true AND slug IS NOT NULL);
