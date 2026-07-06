-- Profiel-intakeformulier (org-gestuurd).
--
-- De initiatiefnemer (bv. CommonCity) verstuurt vanuit het CMS een formulier
-- aan een lid om profielvelden uit te vragen. Het lid vult het in de
-- community-app in; de antwoorden landen in `profiles` (en, voor de top-3
-- woningvoorkeur, in `memberships.housing_preferences`).
--
-- Twee tabellen:
--   * profile_intake_templates — herbruikbare veldselecties per project.
--   * profile_intake_requests   — een verstuurd verzoek aan één lid (met token).

-- ── Sjablonen ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_intake_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  fields      JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["first_name","postal_code",...]
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_templates_project ON profile_intake_templates(project_id);

ALTER TABLE profile_intake_templates ENABLE ROW LEVEL SECURITY;

-- Org-admins (en project-admins) beheren de sjablonen van hun project.
-- has_membership() heeft een OR-clause voor org-admins, dus dit dekt beide.
CREATE POLICY intake_templates_admin_all ON profile_intake_templates
  FOR ALL USING (has_membership(project_id, 'admin'))
  WITH CHECK (has_membership(project_id, 'admin'));

-- ── Verzoeken ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_intake_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fields        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- snapshot van uitgevraagde velden
  token         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  message       TEXT,                                  -- optioneel persoonlijk bericht
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intake_requests_profile ON profile_intake_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_intake_requests_project ON profile_intake_requests(project_id);

ALTER TABLE profile_intake_requests ENABLE ROW LEVEL SECURITY;

-- Admins beheren alle verzoeken van hun project.
CREATE POLICY intake_requests_admin_all ON profile_intake_requests
  FOR ALL USING (has_membership(project_id, 'admin'))
  WITH CHECK (has_membership(project_id, 'admin'));

-- Het lid mag zijn eigen verzoek lezen en afronden (status bijwerken).
CREATE POLICY intake_requests_member_select ON profile_intake_requests
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY intake_requests_member_update ON profile_intake_requests
  FOR UPDATE USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ── RPC: eigen top-3 woningvoorkeur opslaan ─────────────────────────────
-- De profielvelden schrijft het lid rechtstreeks naar `profiles` (bestaande
-- RLS staat dat toe). De top-3 woningvoorkeur leeft op `memberships`, dus
-- daarvoor een smalle SECURITY DEFINER-functie die alleen die ene kolom van
-- de eigen membership-rij aanpast.
CREATE OR REPLACE FUNCTION set_my_housing_preferences(p_project_id UUID, p_prefs JSONB)
RETURNS void AS $$
BEGIN
  UPDATE memberships
  SET housing_preferences = COALESCE(p_prefs, '[]'::jsonb)
  WHERE profile_id = auth.uid() AND project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION set_my_housing_preferences(UUID, JSONB) TO authenticated;
