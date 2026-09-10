-- Gewenst oppervlak wordt een bandbreedte in plaats van een exact aantal m².
-- Mensen weten zelden een precies getal, en een bandbreedte matcht beter met
-- wat projecten daadwerkelijk aanbieden.
--
-- De kolomnaam blijft desired_area_m2: zo hoeft de signup-brug
-- (handle_new_user, migratie 078) niet opnieuw uitgerold te worden. De
-- bestaande getallen worden meteen in de juiste bandbreedte gezet, zodat er
-- geen onleesbare waarden achterblijven.

ALTER TABLE profiles
  ALTER COLUMN desired_area_m2 TYPE text
  USING CASE
    WHEN desired_area_m2 IS NULL  THEN NULL
    WHEN desired_area_m2 < 50     THEN 'tot-50'
    WHEN desired_area_m2 < 75     THEN '50-75'
    WHEN desired_area_m2 < 100    THEN '75-100'
    WHEN desired_area_m2 < 125    THEN '100-125'
    WHEN desired_area_m2 <= 150   THEN '125-150'
    ELSE 'vanaf-150'
  END;

COMMENT ON COLUMN profiles.desired_area_m2 IS
  'Gewenste woonoppervlakte als bandbreedte-slug: tot-50, 50-75, 75-100, 100-125, 125-150, vanaf-150, weet-ik-niet. Was historisch een INT met een exact aantal m².';
