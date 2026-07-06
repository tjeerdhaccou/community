-- Zorg dat tjeerd@coucha.nl en tjeerd@crowdbuilding.com platform admin zijn
UPDATE profiles
SET is_platform_admin = true
WHERE email IN ('tjeerd@coucha.nl', 'tjeerd@crowdbuilding.com')
  AND (is_platform_admin IS NULL OR is_platform_admin = false);
