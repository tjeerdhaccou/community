-- Fix: project-delete crashte op FK violation in audit_logs.
--
-- De `audit_membership_changes` trigger logt elke membership-delete inclusief
-- project_id. Bij een cascade vanuit `delete on projects` is het project op het
-- moment van de trigger al weg, en de FK audit_logs.project_id -> projects(id)
-- klapt op de INSERT.
--
-- Oplossing: in de trigger checken of het project nog bestaat — zo niet, dan
-- is dit een cascading delete; project_id wordt dan NULL in de log-row maar
-- blijft beschikbaar in metadata.

CREATE OR REPLACE FUNCTION trigger_log_membership_change()
RETURNS trigger AS $$
DECLARE
  project_still_exists boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'membership.created', 'membership', NEW.id, NEW.project_id,
      jsonb_build_object('role', NEW.role, 'profile_id', NEW.profile_id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM log_audit_event(
      'membership.role_changed', 'membership', NEW.id, NEW.project_id,
      jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'profile_id', NEW.profile_id)
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM projects WHERE id = OLD.project_id) INTO project_still_exists;
    PERFORM log_audit_event(
      'membership.deleted',
      'membership',
      OLD.id,
      CASE WHEN project_still_exists THEN OLD.project_id ELSE NULL END,
      jsonb_build_object(
        'role', OLD.role,
        'profile_id', OLD.profile_id,
        'project_id', OLD.project_id
      )
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
