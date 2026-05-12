-- log_audit_event faalt op acties zonder auth-context (bv. triggers die
-- vanuit auth.users INSERT komen). audit_logs heeft een RLS-policy die
-- `auth.uid() IS NOT NULL AND user_id = auth.uid()` eist, en die
-- WITH CHECK faalt tijdens een server-side signup.
--
-- Oplossing: system-acties (geen auth.uid()) slaan we gewoon over.
-- Audit logging is bedoeld voor traceren van user-acties, niet voor
-- automatische processen zoals signup-koppelingen.

CREATE OR REPLACE FUNCTION log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  -- Geen auth context = system-actie, sla over
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, project_id, metadata)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_project_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
