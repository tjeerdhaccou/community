-- 041_activity_notifications.sql
-- Activity notification systeem (in-app + email via Resend)
--
-- Bouwt op bestaande tabellen:
--   - notifications (in-app)
--   - notification_preferences (pref_updates/pref_prikbord/pref_events/pref_documents, mute_until)
--   - post_follows (voor "reactie op jouw post" notificaties)
--
-- Voegt toe:
--   - notification_log: audit log van verstuurde emails (debugging + idempotency)
--   - profiles.notifications_onboarded_at: vlag voor eenmalige onboarding modal
--   - sensible defaults voor notification_preferences kolommen

-- ============================================================
-- 1. Email delivery log (debugging + idempotency)
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  reference_id uuid,
  channel text NOT NULL CHECK (channel IN ('email', 'in_app')),
  email text,
  resend_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON notification_log (user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_reference
  ON notification_log (notification_type, reference_id, user_id);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Alleen service role schrijft hier; users kunnen hun eigen log zien
CREATE POLICY notification_log_select_own
  ON notification_log
  FOR SELECT
  USING (user_id = auth.uid() OR is_platform_admin());

-- ============================================================
-- 2. Onboarding flag op profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notifications_onboarded_at timestamptz;

-- ============================================================
-- 3. Sensible defaults voor notification_preferences (opt-out)
-- ============================================================
-- Defaults zijn 'all' op DB-niveau: iedere user krijgt standaard email
-- voor alle 4 de types. Users kunnen dit uitschakelen via onboarding-modal
-- of later in /profiel.

ALTER TABLE notification_preferences
  ALTER COLUMN pref_updates SET DEFAULT 'all',
  ALTER COLUMN pref_prikbord SET DEFAULT 'all',
  ALTER COLUMN pref_events SET DEFAULT 'all',
  ALTER COLUMN pref_documents SET DEFAULT 'all';

-- Index voor snelle lookup vanuit edge function
CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile
  ON notification_preferences (profile_id);

-- ============================================================
-- 4. Backfill: bestaande users een expliciete preferences-rij geven
--    (voor data-consistency) en markeren als "al onboarded" zodat
--    de modal niet alsnog bij bestaande accounts verschijnt.
-- ============================================================

INSERT INTO notification_preferences (profile_id, pref_updates, pref_prikbord, pref_events, pref_documents)
SELECT DISTINCT m.profile_id, 'all', 'all', 'all', 'all'
  FROM memberships m
  LEFT JOIN notification_preferences np ON np.profile_id = m.profile_id
  WHERE np.profile_id IS NULL;

UPDATE profiles p
   SET notifications_onboarded_at = now()
  FROM memberships m
 WHERE m.profile_id = p.id
   AND p.notifications_onboarded_at IS NULL;
