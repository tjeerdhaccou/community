-- ============================================================================
-- Onboarding-vlag: verse groepen landen op "Aan de slag" tot ze klaar/weg zijn
-- ============================================================================
-- Een group-admin wordt na inloggen naar de onboardingchecklist gestuurd zolang
-- deze vlag false is. De checklist zet 'm op true zodra alle stappen klaar zijn
-- of de admin expliciet "naar dashboard" kiest.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN NOT NULL DEFAULT false;

-- Bestaande projecten zijn al ingericht → niet alsnog naar de checklist sturen.
-- Alleen NIEUW aangemaakte projecten (default false) krijgen de onboarding-nudge.
UPDATE projects SET onboarding_dismissed = true WHERE onboarding_dismissed = false;

COMMENT ON COLUMN projects.onboarding_dismissed IS
  'true zodra de group-admin de "Aan de slag"-checklist heeft afgerond of weggeklikt; stopt de auto-redirect na inloggen';
